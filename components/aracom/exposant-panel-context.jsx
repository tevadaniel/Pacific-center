'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Contexte universel pour ouvrir la fiche d'un exposant (slide-over)
 * depuis n'importe où dans le cockpit ARACOM.
 *
 * Usage :
 *   const { open } = useExposantPanel();
 *   <button onClick={() => open(registrationId)}>...</button>
 *
 *   Ou directement : <ExposantLink id={r.id}>{r.organization_name}</ExposantLink>
 *
 * Le rendu de FicheExposant (slide-over) doit être géré par le composant parent qui
 * englobe l'application avec <ExposantPanelProvider> et passe la prop renderPanel.
 */

const ExposantPanelContext = createContext({ open: () => {}, close: () => {}, openId: null, refreshTrigger: 0 });

/**
 * Provider à wrapper autour de toute l'app.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {(id: string, close: () => void) => React.ReactNode} props.renderPanel
 *        Fonction de rendu du panneau exposant (ex: id => <FicheExposant id={id} onClose={close} />)
 */
export function ExposantPanelProvider({ children, renderPanel }) {
  const [openId, setOpenId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const open = useCallback((id) => setOpenId(id), []);
  const close = useCallback(() => {
    setOpenId(null);
    setRefreshTrigger(t => t + 1);
    try { window.dispatchEvent(new CustomEvent('exposant:closed', { detail: { ts: Date.now() } })); } catch (_e) { /* noop */ }
  }, []);
  return (
    <ExposantPanelContext.Provider value={{ open, close, openId, refreshTrigger }}>
      {children}
      {openId && renderPanel && renderPanel(openId, close)}
    </ExposantPanelContext.Provider>
  );
}

export function useExposantPanel() {
  return useContext(ExposantPanelContext);
}

/**
 * Composant utilitaire : un nom d'exposant cliquable qui ouvre le profil universel.
 * Si aucun id n'est fourni, rend simplement le texte sans interaction.
 */
export function ExposantLink({ id, name, className = '', children, ...rest }) {
  const { open } = useExposantPanel();
  if (!id) return <span className={className}>{children || name || '—'}</span>;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); open(id); }}
      className={`text-left hover:text-blue-600 hover:underline cursor-pointer ${className}`}
      data-testid={`open-exposant-${id}`}
      {...rest}
    >
      {children || name || '—'}
    </button>
  );
}
