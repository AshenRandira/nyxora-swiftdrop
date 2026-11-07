package com.nyxora.swiftdrop.parcel.booking;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nyxora.swiftdrop.parcel.booking.dto.BookingResponse;
import com.nyxora.swiftdrop.parcel.booking.dto.CustomerBookingRequest;
import com.nyxora.swiftdrop.parcel.domain.enums.ParcelSize;
import com.nyxora.swiftdrop.parcel.domain.enums.ParcelStatus;
import com.nyxora.swiftdrop.parcel.pricing.ParcelQuoteRequest;
import com.nyxora.swiftdrop.parcel.pricing.ParcelQuoteResponse;
import com.nyxora.swiftdrop.parcel.pricing.QuoteTier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("CustomerParcelController MockMvc Tests")
class CustomerParcelControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CustomerBookingService customerBookingService;

    // ─────────────────────────────────────────────
    //  QUOTE ENDPOINT: POST /api/v1/parcels/quote
    // ─────────────────────────────────────────────

    @Test
    @DisplayName("POST /api/v1/parcels/quote succeeds publicly without auth headers (permitAll)")
    void calculateQuote_publicAccess_returns200() throws Exception {
        ParcelQuoteRequest request = ParcelQuoteRequest.builder()
                .originZoneId(1)
                .destinationZoneId(2)
                .weightKg(new BigDecimal("2.50"))
                .parcelSize(ParcelSize.MEDIUM)
                .tier(QuoteTier.STANDARD)
                .build();

        ParcelQuoteResponse response = ParcelQuoteResponse.builder()
                .appliedTier(QuoteTier.STANDARD)
                .baseFee(new BigDecimal("300.00"))
                .weightCharge(new BigDecimal("100.00"))
                .sizeMultiplier(new BigDecimal("1.20"))
                .zoneSurcharge(new BigDecimal("50.00"))
                .discountAmount(BigDecimal.ZERO)
                .expressSurcharge(BigDecimal.ZERO)
                .totalFee(new BigDecimal("530.00"))
                .build();

        when(customerBookingService.calculateQuote(any(ParcelQuoteRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/parcels/quote")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appliedTier").value("STANDARD"))
                .andExpect(jsonPath("$.totalFee").value(530.00))
                .andExpect(jsonPath("$.baseFee").value(300.00));
    }

    @Test
    @DisplayName("POST /api/v1/parcels/quote returns 422 when validation fails (missing origin zone)")
    void calculateQuote_invalidPayload_returns422() throws Exception {
        ParcelQuoteRequest invalidRequest = ParcelQuoteRequest.builder()
                .destinationZoneId(2)
                .weightKg(new BigDecimal("2.50"))
                .parcelSize(ParcelSize.MEDIUM)
                .tier(QuoteTier.STANDARD)
                .build();

        mockMvc.perform(post("/api/v1/parcels/quote")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.originZoneId").exists());
    }

    // ─────────────────────────────────────────────
    //  BOOK ENDPOINT: POST /api/v1/parcels/book
    // ─────────────────────────────────────────────

    @Test
    @DisplayName("POST /api/v1/parcels/book returns 403 Forbidden when unauthenticated (no role header)")
    void bookParcel_unauthenticated_returns403() throws Exception {
        CustomerBookingRequest request = CustomerBookingRequest.builder()
                .originZoneId(1)
                .destinationZoneId(2)
                .pickupAddress("Colombo 03")
                .dropoffAddress("Kandy")
                .recipientName("Kamal Perera")
                .recipientPhone("0771234567")
                .weightKg(new BigDecimal("2.00"))
                .parcelSize(ParcelSize.SMALL)
                .tier(QuoteTier.STANDARD)
                .build();

        mockMvc.perform(post("/api/v1/parcels/book")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/v1/parcels/book returns 403 Forbidden when X-User-Id header is missing")
    void bookParcel_missingUserIdHeader_returns403() throws Exception {
        CustomerBookingRequest request = CustomerBookingRequest.builder()
                .originZoneId(1)
                .destinationZoneId(2)
                .pickupAddress("Colombo 03")
                .dropoffAddress("Kandy")
                .recipientName("Kamal Perera")
                .recipientPhone("0771234567")
                .weightKg(new BigDecimal("2.00"))
                .parcelSize(ParcelSize.SMALL)
                .tier(QuoteTier.STANDARD)
                .build();

        // Without X-User-Id, GatewayHeaderAuthFilter cannot establish auth, so Spring Security denies with 403
        mockMvc.perform(post("/api/v1/parcels/book")
                        .header("X-User-Role", "ROLE_CUSTOMER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/v1/parcels/book returns 400 Bad Request when X-User-Id header is not a valid UUID")
    void bookParcel_invalidUserIdFormat_returns400() throws Exception {
        CustomerBookingRequest request = CustomerBookingRequest.builder()
                .originZoneId(1)
                .destinationZoneId(2)
                .pickupAddress("Colombo 03")
                .dropoffAddress("Kandy")
                .recipientName("Kamal Perera")
                .recipientPhone("0771234567")
                .weightKg(new BigDecimal("2.00"))
                .parcelSize(ParcelSize.SMALL)
                .tier(QuoteTier.STANDARD)
                .build();

        mockMvc.perform(post("/api/v1/parcels/book")
                        .header("X-User-Id", "not-a-valid-uuid")
                        .header("X-User-Role", "ROLE_CUSTOMER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Type Mismatch"))
                .andExpect(jsonPath("$.detail").value("Invalid format for parameter or header 'X-User-Id'."));
    }

    @Test
    @DisplayName("POST /api/v1/parcels/book returns 201 Created with valid customer request")
    void bookParcel_validCustomerRequest_returns201() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID parcelId = UUID.randomUUID();

        CustomerBookingRequest request = CustomerBookingRequest.builder()
                .originZoneId(1)
                .destinationZoneId(2)
                .pickupAddress("No. 45, Galle Road, Colombo 03")
                .dropoffAddress("No. 128, Kandy Road, Peradeniya")
                .recipientName("Kamal Perera")
                .recipientPhone("0771234567")
                .weightKg(new BigDecimal("2.50"))
                .parcelSize(ParcelSize.MEDIUM)
                .tier(QuoteTier.STANDARD)
                .build();

        BookingResponse response = BookingResponse.builder()
                .parcelId(parcelId)
                .trackingNumber("SD-20261107-7K9P2X")
                .currentStatus(ParcelStatus.CREATED)
                .senderUserId(userId)
                .originZoneId(1)
                .originZoneCode("WP-COL-01")
                .originZoneName("Colombo Central")
                .destinationZoneId(2)
                .destinationZoneCode("CP-KAN-01")
                .destinationZoneName("Kandy Metro")
                .pickupAddress("No. 45, Galle Road, Colombo 03")
                .dropoffAddress("No. 128, Kandy Road, Peradeniya")
                .recipientName("Kamal Perera")
                .recipientPhone("0771234567")
                .weightKg(new BigDecimal("2.50"))
                .parcelSize(ParcelSize.MEDIUM)
                .appliedTier(QuoteTier.STANDARD)
                .estimatedFee(new BigDecimal("530.00"))
                .currency("LKR")
                .createdAt(Instant.now())
                .build();

        when(customerBookingService.bookParcel(any(CustomerBookingRequest.class), eq(userId))).thenReturn(response);

        mockMvc.perform(post("/api/v1/parcels/book")
                        .header("X-User-Id", userId.toString())
                        .header("X-User-Role", "ROLE_CUSTOMER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.trackingNumber").value("SD-20261107-7K9P2X"))
                .andExpect(jsonPath("$.currentStatus").value("CREATED"))
                .andExpect(jsonPath("$.estimatedFee").value(530.00))
                .andExpect(jsonPath("$.currency").value("LKR"));
    }

    @Test
    @DisplayName("POST /api/v1/parcels/book returns 422 when recipient phone format is invalid")
    void bookParcel_invalidPhone_returns422() throws Exception {
        UUID userId = UUID.randomUUID();

        CustomerBookingRequest invalidPhoneRequest = CustomerBookingRequest.builder()
                .originZoneId(1)
                .destinationZoneId(2)
                .pickupAddress("No. 45, Galle Road, Colombo 03")
                .dropoffAddress("No. 128, Kandy Road, Peradeniya")
                .recipientName("Kamal Perera")
                .recipientPhone("12345") // Invalid phone number
                .weightKg(new BigDecimal("2.50"))
                .parcelSize(ParcelSize.MEDIUM)
                .tier(QuoteTier.STANDARD)
                .build();

        mockMvc.perform(post("/api/v1/parcels/book")
                        .header("X-User-Id", userId.toString())
                        .header("X-User-Role", "ROLE_CUSTOMER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidPhoneRequest)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.recipientPhone").exists());
    }
}
