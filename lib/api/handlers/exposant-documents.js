import { NextResponse } from 'next/server';
import { err } from '../helpers';

/**
 * 🆕 SESSION 28 — Handlers GET pour téléchargement des PDFs exposants.
 *
 * Routes prises en charge (GET) :
 *   GET /api/exposant/documents/convention/:regId
 *   GET /api/exposant/documents/guide/:regId
 *   GET /api/exposant/documents/questionnaire-blank[/{regId}]
 *   GET /api/exposant/documents/questionnaire/:orgId
 *
 * Chaque endpoint génère un PDF en mémoire et le retourne avec Content-Type=application/pdf.
 * Les générateurs PDF sont importés dynamiquement pour éviter de gonfler le bundle initial.
 *
 * @param {object} args
 * @param {import('mongodb').Db} args.db
 * @param {string} args.route
 * @param {string[]} args.p
 * @returns {Promise<Response|null>} Response si la route est gérée, null sinon
 */
export async function handleExposantDocumentsGet({ db, route, p }) {
  // 📄 Convention de participation
  if (route.match(/^exposant\/documents\/convention\/[^/]+$/)) {
    const regId = p[3];
    const reg = await db.collection('registrations').findOne({ id: regId });
    if (!reg) return err('Inscription introuvable', 404);
    const org = await db.collection('organizations').findOne({ id: reg.organization_id });
    const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
    const animations = await db.collection('animation_slots').find({ registration_id: regId, status: { $ne: 'annulé' } }).toArray();
    try {
      const { generateConventionPDF } = await import('@/lib/document-generator');
      const pdf = await generateConventionPDF({ registration: reg, organization: org, venue, animations });
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Convention_${(org?.name || 'exposant').replace(/[^a-z0-9_-]/gi, '_')}.pdf"`,
          'Cache-Control': 'no-cache',
        },
      });
    } catch (e) {
      console.error('[convention-pdf]', e);
      return err('Erreur génération PDF : ' + e.message, 500);
    }
  }

  // 📕 Guide de l'Exposant
  if (route.match(/^exposant\/documents\/guide\/[^/]+$/)) {
    const regId = p[3];
    const reg = await db.collection('registrations').findOne({ id: regId });
    if (!reg) return err('Inscription introuvable', 404);
    const org = await db.collection('organizations').findOne({ id: reg.organization_id });
    const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
    const animations = await db.collection('animation_slots').find({ registration_id: regId, status: { $ne: 'annulé' } }).toArray();
    try {
      const { generateGuidePDF } = await import('@/lib/document-generator');
      const pdf = await generateGuidePDF({ registration: reg, organization: org, venue, animations });
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Guide_Exposant_${(org?.name || 'exposant').replace(/[^a-z0-9_-]/gi, '_')}.pdf"`,
          'Cache-Control': 'no-cache',
        },
      });
    } catch (e) {
      console.error('[guide-pdf]', e);
      return err('Erreur génération PDF : ' + e.message, 500);
    }
  }

  // 📝 Questionnaire VIERGE — imprimable (avec ou sans pré-remplissage)
  if (route === 'exposant/documents/questionnaire-blank' || route.match(/^exposant\/documents\/questionnaire-blank\/[^/]+$/)) {
    const regId = p[3] || null;
    let reg = null, org = null, venue = null;
    if (regId) {
      reg = await db.collection('registrations').findOne({ id: regId });
      if (reg) {
        org = await db.collection('organizations').findOne({ id: reg.organization_id });
        venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
      }
    }
    try {
      const { generateQuestionnaireBlankPDF } = await import('@/lib/document-generator');
      const pdf = await generateQuestionnaireBlankPDF({ organization: org, registration: reg, venue });
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Questionnaire_Vierge_${(org?.name || 'forum2026').replace(/[^a-z0-9_-]/gi, '_')}.pdf"`,
          'Cache-Control': 'no-cache',
        },
      });
    } catch (e) {
      console.error('[questionnaire-blank-pdf]', e);
      return err('Erreur génération PDF : ' + e.message, 500);
    }
  }

  // 📋 Questionnaire REMPLI — récapitulatif des réponses soumises
  if (route.match(/^exposant\/documents\/questionnaire\/[^/]+$/)) {
    const orgId = p[3];
    const response = await db.collection('satisfaction_responses').findOne({ organization_id: orgId });
    if (!response) return err('Aucune réponse trouvée pour cette organisation', 404);
    const org = await db.collection('organizations').findOne({ id: orgId });
    const venue = response.venue_id ? await db.collection('venues').findOne({ id: response.venue_id }) : null;
    try {
      const { generateQuestionnaireFilledPDF } = await import('@/lib/document-generator');
      const pdf = await generateQuestionnaireFilledPDF({ response, organization: org, venue });
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Satisfaction_Reponses_${(org?.name || 'exposant').replace(/[^a-z0-9_-]/gi, '_')}.pdf"`,
          'Cache-Control': 'no-cache',
        },
      });
    } catch (e) {
      console.error('[questionnaire-filled-pdf]', e);
      return err('Erreur génération PDF : ' + e.message, 500);
    }
  }

  return null; // Route non gérée par ce module
}
