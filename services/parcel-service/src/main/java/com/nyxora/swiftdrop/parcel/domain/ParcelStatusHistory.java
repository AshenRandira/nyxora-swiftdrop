package com.nyxora.swiftdrop.parcel.domain;

import com.nyxora.swiftdrop.parcel.domain.enums.ParcelStatus;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Immutable audit record of a parcel's status transition.
 * Each time a parcel status changes (e.g., PICKED_UP → IN_TRANSIT), a new history
 * entry is inserted. This forms the complete delivery timeline and supports
 * Proof of Delivery (signature name + photo URL) when status is DELIVERED.
 *
 * <p>Maps to the {@code parcel_status_history} table in {@code parcel_db}.
 */
@Entity
@Table(
        name = "parcel_status_history",
        indexes = {
                @Index(name = "idx_status_history_parcel", columnList = "parcel_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParcelStatusHistory extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * The parcel this status history record belongs to.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "parcel_id", nullable = false)
    private Parcel parcel;

    /**
     * The new status that was applied during this transition.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private ParcelStatus status;

    /**
     * UUID of the user (courier or dispatcher) who triggered this status change.
     * Logical reference to auth_db.users.id — not a DB FK.
     */
    @Column(name = "updated_by_user_id", nullable = false)
    private UUID updatedByUserId;

    /**
     * Optional free-text note added by the courier during status update
     * (e.g., "Parcel left at reception desk").
     */
    @Column(name = "delivery_note", columnDefinition = "TEXT")
    private String deliveryNote;

    /**
     * Full name of the recipient who signed for the parcel.
     * Required when status is DELIVERED (Proof of Delivery).
     */
    @Column(name = "recipient_signature_name", length = 150)
    private String recipientSignatureName;

    /**
     * URL to the uploaded proof-of-delivery photo stored in S3/MinIO.
     * Required when status is DELIVERED.
     */
    @Column(name = "proof_photo_url", length = 500)
    private String proofPhotoUrl;

    /**
     * Reason the delivery failed. Required when status is FAILED.
     * (e.g., "ADDRESS_NOT_FOUND", "RECIPIENT_UNAVAILABLE").
     */
    @Column(name = "failure_reason", length = 100)
    private String failureReason;
}

