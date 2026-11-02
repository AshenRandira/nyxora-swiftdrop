package com.nyxora.swiftdrop.parcel.domain.repository;

import com.nyxora.swiftdrop.parcel.domain.Parcel;
import com.nyxora.swiftdrop.parcel.domain.enums.ParcelStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link Parcel}.
 * Provides tracking, sender, merchant, and courier-based parcel lookup operations.
 */
@Repository
public interface ParcelRepository extends JpaRepository<Parcel, UUID> {

    /** Public tracking lookup — no authentication required (whitelisted in Gateway). */
    Optional<Parcel> findByTrackingNumber(String trackingNumber);

    /** Returns all parcels booked by a given customer (by their auth_db user UUID). */
    List<Parcel> findBySenderUserId(UUID senderUserId);

    /** Returns all parcels booked under a merchant account. */
    List<Parcel> findByMerchantId(UUID merchantId);

    /**
     * Returns active deliveries assigned to a specific courier.
     * Used by the Dispatcher (UC19) to check workload before assigning new parcels.
     */
    List<Parcel> findByAssignedCourierIdAndCurrentStatus(UUID courierId, ParcelStatus status);

    /** Returns all parcels assigned to a courier (all statuses). */
    List<Parcel> findByAssignedCourierId(UUID courierId);

    /** Check that a generated tracking number does not already exist. */
    boolean existsByTrackingNumber(String trackingNumber);
}

