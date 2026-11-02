package com.nyxora.swiftdrop.parcel.domain;

import com.nyxora.swiftdrop.parcel.domain.enums.ParcelSize;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Defines the inter-zone pricing matrix entry used by the Dynamic Pricing Strategy Engine.
 * Each rule uniquely identifies the combination of origin zone, destination zone, and parcel size.
 *
 * <p>Formula applied by {@code StandardZonePricingStrategy}:
 * <pre>
 *   fee = (baseFee + (weightKg * ratePerKg)) * sizeMultiplier + destinationZone.baseSurcharge
 * </pre>
 *
 * <p>Maps to the {@code pricing_rules} table in {@code parcel_db}.
 */
@Entity
@Table(
        name = "pricing_rules",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_pricing_rule",
                        columnNames = {"origin_zone_id", "destination_zone_id", "parcel_size"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PricingRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /**
     * The zone where the parcel is picked up from.
     */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "origin_zone_id", nullable = false)
    private DeliveryZone originZone;

    /**
     * The zone where the parcel is to be delivered.
     */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "destination_zone_id", nullable = false)
    private DeliveryZone destinationZone;

    /**
     * Fixed base delivery fee for this zone pair, in LKR.
     */
    @Column(name = "base_fee", nullable = false, precision = 10, scale = 2)
    private BigDecimal baseFee;

    /**
     * Variable fee charged per kilogram of parcel weight, in LKR.
     */
    @Column(name = "rate_per_kg", nullable = false, precision = 10, scale = 2)
    private BigDecimal ratePerKg;

    /**
     * The parcel size tier this rule applies to: SMALL, MEDIUM, or LARGE.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "parcel_size", nullable = false, length = 30)
    private ParcelSize parcelSize;

    /**
     * Multiplier applied to the calculated delivery fee based on parcel size.
     * Defaults to 1.00 (no adjustment). Larger parcels typically have a higher multiplier.
     */
    @Column(name = "size_multiplier", nullable = false, precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal sizeMultiplier = BigDecimal.ONE;
}

