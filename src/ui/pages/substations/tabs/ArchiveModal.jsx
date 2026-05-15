/**
 * ArchiveModal.jsx — extrait de DemandesQueueTab pour contrôler la taille.
 * Gère la confirmation de raccordement et d'annulation d'une demande.
 */
import React from 'react';
import { f1 } from '../../../../utils/format.js';
import { CONNECTED_RETENTION_DEFAULT_MONTHS } from '../../../../constants/index.js';
import {
  reqGrdPrelevFerme,
  reqGrdPrelevFlexible,
  reqGrdInjFerme,
  reqGrdInjFlexible,
} from '../../../../engines/queue.js';
import { getAssessment, getCustomer, getOffer } from '../../../../engines/requestModel.js';

export function ArchiveModal({ archiveModal, onConfirm, onCancel }) {
  if (!archiveModal) return null;
  const { req, targetStatus } = archiveModal;
  const isRacc = targetStatus === 'raccordée';
  const grdPF = reqGrdPrelevFerme(req);
  const grdFl = reqGrdPrelevFlexible(req);
  const grdIF = reqGrdInjFerme(req);
  const grdIFl = reqGrdInjFlexible(req);
  const assessment = getAssessment(req);
  const customer = getCustomer(req);
  const offer = getOffer(req);
  const retentionMonths = offer.connectedRetentionMonths || CONNECTED_RETENTION_DEFAULT_MONTHS;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26,18,48,.55)',
        backdropFilter: 'blur(8px)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg-raised)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflow: 'auto',
          animation: 'v3-scaleIn .2s cubic-bezier(.16,1,.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            background: isRacc ? 'var(--inj-dim)' : 'var(--red-dim)',
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: isRacc ? 'var(--inj-text)' : 'var(--red)',
              marginBottom: 4,
            }}
          >
            {isRacc ? '✓ Confirmer le raccordement' : '✕ Archiver comme annulée'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
            {customer.client?.name}
          </p>
          {customer.client?.reference && (
            <p
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                marginTop: 2,
              }}
            >
              {customer.client.reference}
            </p>
          )}
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isRacc ? (
            <>
              {/* Contrat GRD */}
              {grdPF + grdFl + grdIF + grdIFl > 0 && (
                <div
                  style={{
                    background: 'var(--accent-bg)',
                    border: '1px solid var(--border-accent)',
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '.07em',
                      color: 'var(--accent-muted)',
                      marginBottom: 10,
                    }}
                  >
                    Contrat GRD
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                    {grdPF > 0 && (
                      <PowerBox
                        label="Prél. ferme"
                        value={grdPF}
                        color="var(--prelev)"
                        dim="var(--prelev-dim)"
                      />
                    )}
                    {grdFl > 0 && (
                      <PowerBox
                        label="Prél. flexible"
                        value={grdFl}
                        color="var(--amber)"
                        dim="var(--amber-dim)"
                      />
                    )}
                    {grdIF > 0 && (
                      <PowerBox
                        label="Inj. garantie"
                        value={grdIF}
                        color="var(--inj)"
                        dim="var(--inj-dim)"
                      />
                    )}
                    {grdIFl > 0 && (
                      <PowerBox
                        label="Inj. curtailable"
                        value={grdIFl}
                        color="var(--green)"
                        dim="var(--green-dim)"
                      />
                    )}
                  </div>
                  {assessment.final?.load?.reason && (
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        marginTop: 8,
                        fontStyle: 'italic',
                      }}
                    >
                      {assessment.final.load.reason}
                    </p>
                  )}
                </div>
              )}

              <div
                style={{
                  background: 'var(--green-dim)',
                  border: '1.5px solid rgba(5,150,105,.2)',
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.07em',
                    color: 'var(--green)',
                    marginBottom: 10,
                  }}
                >
                  Maintien de capacité après raccordement
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  La puissance raccordée restera comptée comme réservation active pendant
                  <strong> {retentionMonths} mois</strong>. La durée se modifie ensuite dans
                  l’onglet Raccordés ou dans le dossier.
                </p>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              La demande sera archivée comme annulée. La capacité réservée sera libérée
              immédiatement.
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="btn-secondary" onClick={onCancel}>
              Annuler
            </button>
            <button
              onClick={onConfirm}
              style={{
                background: isRacc ? 'var(--inj)' : 'var(--red)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 20px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {isRacc ? '✓ Confirmer le raccordement' : '✕ Archiver'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PowerBox({ label, value, color, dim }) {
  return (
    <div
      style={{
        background: dim,
        borderRadius: 8,
        padding: '8px 12px',
        border: `1.5px solid ${color}33`,
      }}
    >
      <p
        style={{
          fontSize: 9,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '.05em',
          marginBottom: 3,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>
        {f1(value)} <span style={{ fontSize: 10, fontWeight: 400 }}>MVA</span>
      </p>
    </div>
  );
}
