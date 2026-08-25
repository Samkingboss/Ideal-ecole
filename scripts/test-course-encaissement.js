// ═══ TEST DE CONCURRENCE RÉELLE ═══
// À coller dans la console de comptabilite.html, dans DEUX navigateurs
// différents (pas deux onglets : le stockage local est partagé), chacun
// connecté avec un compte distinct de la direction.
//
// Dans le premier :  await course('A', 30000, 'Espèces')
// Dans le second :   await course('B', 50000, 'Wave')
// Lancez le second dans les deux secondes qui suivent le premier.
window.course = async function (etiquette, montant, mode) {
  const MAT = '26-27 A008';
  const K = _SUPA_KEY;
  const base = async () => {
    const q = await fetch(`${_SUPA_URL}/rest/v1/financement_params?select=state_json&id=eq.main`,
      { headers: { apikey: K, Authorization: 'Bearer ' + K }, cache: 'no-store' });
    const e = ((await q.json())[0].state_json.students || []).find(x => x.matricule === MAT);
    return { paye: e?.paye, nb: (e?.history || []).length,
             recus: (e?.history || []).map(h => h.receiptId) };
  };
  const { data: sess } = await _supa.auth.getSession();
  if (!sess?.session) return '❌ Aucune session : connectez-vous au portail avant.';

  const avant = await base();
  const s = studentsData.find(x => x.matricule === MAT);
  if (!s) return '❌ Élève ' + MAT + ' absent de la comptabilité de cet appareil.';

  window.confirm = () => false; window.print = () => {};
  const msgs = []; window.alert = m => msgs.push(String(m).slice(0, 140));

  openPaymentModal(s.id, s.nom + ' ' + s.prenom);
  document.getElementById('paybtn-montant').value = String(montant);
  document.getElementById('paybtn-mode').value = mode;
  document.getElementById('paybtn-motif').value = 'Régularisation Globale';
  const t0 = performance.now();
  await submitPayment();
  const ms = Math.round(performance.now() - t0);

  await new Promise(r => setTimeout(r, 2500));
  const apres = await base();
  return {
    appareil: etiquette, montant, ms, messages: msgs,
    avant, apres,
    ajouteParMoi: apres.paye - avant.paye,
    // À comparer entre les deux appareils : le second doit voir +80 000
    // au total, et deux reçus distincts.
  };
};
console.log('Prêt. Lancez :  await course("A", 30000, "Espèces")');
