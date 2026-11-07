package com.nyxora.swiftdrop.parcel.booking;

import com.nyxora.swiftdrop.parcel.booking.dto.BookingResponse;
import com.nyxora.swiftdrop.parcel.booking.dto.CustomerBookingRequest;
import com.nyxora.swiftdrop.parcel.pricing.ParcelQuoteRequest;
import com.nyxora.swiftdrop.parcel.pricing.ParcelQuoteResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Member 4 — Dedicated Customer & Merchant Parcel Operations Controller.
 * Provides thin REST endpoints for rate estimation and delivery booking
 * under {@code /api/v1/parcels/**}.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/parcels")
@RequiredArgsConstructor
@Tag(name = "Customer: Parcel Delivery & Booking", description = "Member 4 — Parcel rate quotes, booking, tracking, and receipts")
public class CustomerParcelController {

    private final CustomerBookingService customerBookingService;

    /**
     * Public instant rate quote endpoint.
     * Computes the transparent fee breakdown based on origin zone, destination zone,
     * weight, size, and pricing tier using Member 3's Dynamic Pricing Engine.
     */
    @PostMapping("/quote")
    @Operation(
            summary = "Calculate delivery rate quote",
            description = "Public endpoint providing instant, itemized rate calculations across Sri Lankan zones."
    )
    public ResponseEntity<ParcelQuoteResponse> calculateQuote(
            @Valid @RequestBody ParcelQuoteRequest request
    ) {
        log.debug("Received delivery rate quote request for originZone={}, destZone={}, weight={}kg",
                request.getOriginZoneId(), request.getDestinationZoneId(), request.getWeightKg());
        return ResponseEntity.ok(customerBookingService.calculateQuote(request));
    }

    /**
     * Customer delivery booking endpoint.
     * Validates zones, generates a unique linear tracking number, persists the delivery record,
     * logs the initial lifecycle audit entry, and publishes a domain event to RabbitMQ.
     */
    @PostMapping("/book")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'MERCHANT', 'ADMIN')")
    @SecurityRequirement(name = "BearerAuth")
    @Operation(
            summary = "Book a new parcel delivery",
            description = "Protected endpoint for customers and merchants to book parcel deliveries. Requires ROLE_CUSTOMER, ROLE_MERCHANT, or ROLE_ADMIN."
    )
    public ResponseEntity<BookingResponse> bookParcel(
            @Parameter(description = "Authenticated user UUID injected by API Gateway", required = true)
            @RequestHeader("X-User-Id") UUID senderUserId,
            @Valid @RequestBody CustomerBookingRequest request
    ) {
        log.info("Processing parcel booking request for senderUserId={}", senderUserId);
        BookingResponse response = customerBookingService.bookParcel(request, senderUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
