package com.nyxora.swiftdrop.parcel.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Represents a logical Sri Lankan delivery zone (e.g., a district or sub-district).
 * Zone codes follow the format: {@code <PROVINCE>-<DISTRICT>-<INDEX>}, e.g. {@code WP-COL-01}.
 *
 * <p>This is the foundational entity for the Dynamic Pricing Strategy Engine.
 * Members 2, 4, 5, and 6 depend on this entity being merged first.
 *
 * <p>Maps to the {@code delivery_zones} table in {@code parcel_db}.
 */
@Entity
@Table(name = "delivery_zones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliveryZone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /**
     * Unique zone identifier code following the format WP-COL-01.
     * Used in pricing rule lookups and parcel booking.
     */
    @Column(name = "zone_code", nullable = false, unique = true, length = 20)
    private String zoneCode;

    @Column(name = "zone_name", nullable = false, length = 100)
    private String zoneName;

    /**
     * The Sri Lankan district this zone belongs to (e.g., "Colombo", "Kandy").
     */
    @Column(name = "district", nullable = false, length = 50)
    private String district;

    /**
     * Fixed surcharge added on top of the calculated delivery fee for parcels
     * delivered INTO this zone. Defaults to 0.00.
     */
    @Column(name = "base_surcharge", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal baseSurcharge = BigDecimal.ZERO;

    /**
     * Whether this zone is currently active for parcel bookings and dispatch.
     * Inactive zones cannot be selected as origin or destination.
     */
    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}

