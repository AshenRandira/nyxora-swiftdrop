package com.nyxora.swiftdrop.parcel.domain;

import com.nyxora.swiftdrop.parcel.domain.enums.ParcelSize;
import com.nyxora.swiftdrop.parcel.domain.enums.ParcelStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Core parcel delivery booking entity. Each parcel represents a single
 * end-to-end delivery job from a sender to a recipient across two Sri Lankan zones.
 *
 * <p>Tracking numbers follow the format: {@code SD-YYYYMMDD-XXXXXX} (e.g. {@code SD-20261102-000001}).
 *
 * <p>Cross-service references (senderUserId, merchantId, assignedCourierId) are stored
 * as raw UUIDs — no foreign key constraints across database boundaries, adhering to
 * the zero-cross-database-query architecture constraint.
 *
 * <p>Maps to the {@code parcels} table in {@code parcel_db}.
 */
@Entity
@Table(
        name = "parcels",
        indexes = {
                @Index(name = "idx_parcels_tracking",       columnList = "tracking_number"),
                @Index(name = "idx_parcels_sender",         columnList = "sender_user_id"),
                @Index(name = "idx_parcels_merchant",       columnList = "merchant_id"),
                @Index(name = "idx_parcels_courier_status", columnList = "assigned_courier_id, current_status")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Parcel extends BaseAuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * System-generated unique tracking number in the format SD-YYYYMMDD-XXXXXX.
     * Exposed publicly via the track endpoint (no authentication required).
     */
    @Column(name = "tracking_number", nullable = false, unique = true, length = 50)
    private String trackingNumber;

    /**
     * UUID of the user who booked this parcel. Logical reference to auth_db.users.id.
     * Not a database FK — resolved via inter-service communication.
     */
    @Column(name = "sender_user_id", nullable = false)
    private UUID senderUserId;

    /**
     * UUID of the merchant account if this parcel was booked via Machine-to-Machine OAuth 2.0.
     * Null for direct customer bookings. Logical reference to auth_db.merchants.id.
     */
    @Column(name = "merchant_id")
    private UUID merchantId;

    /**
     * UUID of the courier assigned by the Dispatcher to handle this delivery.
     * Null until dispatched. Logical reference to auth_db.couriers.id.
     */
    @Column(name = "assigned_courier_id")
    private UUID assignedCourierId;

    /**
     * Delivery zone where the parcel is collected from.
     */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "origin_zone_id", nullable = false)
    private DeliveryZone originZone;

    /**
     * Delivery zone where the parcel is to be delivered.
     */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "destination_zone_id", nullable = false)
    private DeliveryZone destinationZone;

    @Column(name = "pickup_address", nullable = false, columnDefinition = "TEXT")
    private String pickupAddress;

    @Column(name = "dropoff_address", nullable = false, columnDefinition = "TEXT")
    private String dropoffAddress;

    @Column(name = "recipient_name", nullable = false, length = 150)
    private String recipientName;

    @Column(name = "recipient_phone", nullable = false, length = 20)
    private String recipientPhone;

    /**
     * Weight of the parcel in kilograms. Used in pricing calculation.
     */
    @Column(name = "weight_kg", nullable = false, precision = 6, scale = 2)
    private BigDecimal weightKg;

    /**
     * Size tier of the parcel — maps to the size_multiplier in the PricingRule.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "parcel_size", nullable = false, length = 30)
    private ParcelSize parcelSize;

    /**
     * Pre-calculated delivery fee at the time of booking using the Dynamic Pricing Engine.
     */
    @Column(name = "estimated_fee", nullable = false, precision = 10, scale = 2)
    private BigDecimal estimatedFee;

    /**
     * Current lifecycle status of the parcel. Transitions are enforced by the
     * courier status-update and dispatcher-assignment flows.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "current_status", nullable = false, length = 40)
    @Builder.Default
    private ParcelStatus currentStatus = ParcelStatus.CREATED;
}

