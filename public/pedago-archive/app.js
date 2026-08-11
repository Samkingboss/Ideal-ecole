// State Management
let students = JSON.parse(localStorage.getItem('ideal_students')) || [];
let homeworks = JSON.parse(localStorage.getItem('ideal_homeworks')) || [];
let currentHomeworkImages = [];
// Classes que l'utilisateur connecté a le droit de servir. Remplie par la
// synchronisation Supabase en fin de fichier : un enseignant n'y trouve que
// les siennes (prof_classes), la direction et le conseiller toutes.
let classesAutorisees = [];

// ═══════════ PÉRIMÈTRE DE CLASSES ET DESTINATAIRES ═══════════

function remplirClasses() {
    const sel = document.getElementById('grade-select');
    if (!sel) return;
    const choisi = sel.value;
    if (!classesAutorisees.length) {
        sel.innerHTML = '<option value="">Aucune classe ne vous est affectée</option>';
        sel.disabled = true;
        return;
    }
    sel.disabled = false;
    sel.innerHTML = '<option value="">Choisir une classe</option>'
        + classesAutorisees.map(c => `<option value="${c}">${c}</option>`).join('');
    // Une seule classe : on la présélectionne, le prof n'a rien à choisir.
    if (classesAutorisees.length === 1) sel.value = classesAutorisees[0];
    else if (choisi && classesAutorisees.includes(choisi)) sel.value = choisi;
    majDestinataires();
}

function modeDestinataires() {
    const r = document.querySelector('input[name="dest-mode"]:checked');
    return r ? r.value : 'classe';
}

// Équivalences de nommage des classes. Les élèves peuvent arriver de deux
// sources (table `eleves` via `classes.nom`, ou `inscriptions.classe_demandee`)
// qui n'écrivent pas forcément la classe pareil. Une comparaison stricte a
// deja masque toute la Petite Section a son enseignante : le menu proposait
// « PS » quand les eleves portaient « Petite Section ».
const SYNONYMES_CLASSE = [
    ['ps', 'petite section'],
    ['ms', 'moyenne section'],
    ['gs', 'grande section'],
];

function normaliserClasse(v) {
    const n = String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/\s+/g, ' ').trim();
    const paire = SYNONYMES_CLASSE.find(p => p.includes(n));
    return paire ? paire[1] : n;   // on retient toujours la forme longue
}

function memeClasse(a, b) {
    return !!a && !!b && normaliserClasse(a) === normaliserClasse(b);
}

// Élèves de la classe actuellement choisie
function elevesDeLaClasse() {
    const grade = (document.getElementById('grade-select') || {}).value || '';
    return students.filter(s => memeClasse(s.grade, grade));
}

// Destinataires retenus : toute la classe, ou les élèves cochés
function destinatairesRetenus() {
    const liste = elevesDeLaClasse();
    if (modeDestinataires() === 'classe') return liste;
    const coches = new Set(
        Array.from(document.querySelectorAll('#dest-liste input[type="checkbox"]:checked')).map(c => c.value)
    );
    return liste.filter(s => coches.has(String(s.id)));
}

function majDestinataires() {
    const zone = document.getElementById('dest-liste');
    const resume = document.getElementById('dest-resume');
    if (!zone || !resume) return;
    const liste = elevesDeLaClasse();
    const parChoix = modeDestinataires() === 'choix';
    zone.style.display = parChoix ? 'block' : 'none';

    if (parChoix) {
        // On reconstruit en conservant les cases déjà cochées.
        const dejaCoches = new Set(
            Array.from(zone.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value)
        );
        zone.innerHTML = liste.length
            ? `<div style="display:flex; gap:8px; margin-bottom:8px;">
                   <button type="button" class="btn btn-secondary" style="font-size:.75rem; padding:4px 10px;" onclick="cocherTousEleves(true)">Tout cocher</button>
                   <button type="button" class="btn btn-secondary" style="font-size:.75rem; padding:4px 10px;" onclick="cocherTousEleves(false)">Tout décocher</button>
               </div>`
              + liste.map(s => `
                <label style="display:flex; align-items:center; gap:8px; padding:5px 2px; cursor:pointer;">
                    <input type="checkbox" value="${s.id}" ${dejaCoches.has(String(s.id)) ? 'checked' : ''} onchange="majResumeDestinataires()">
                    <span>${s.name}</span>
                </label>`).join('')
            : '<div style="color:#6b7280; font-size:.85rem;">Aucun élève dans cette classe.</div>';
    }
    majResumeDestinataires();
}

function cocherTousEleves(etat) {
    document.querySelectorAll('#dest-liste input[type="checkbox"]').forEach(c => { c.checked = etat; });
    majResumeDestinataires();
}

function majResumeDestinataires() {
    const resume = document.getElementById('dest-resume');
    if (!resume) return;
    const grade = (document.getElementById('grade-select') || {}).value || '';
    if (!grade) { resume.textContent = 'Choisissez d’abord une classe.'; return; }
    const total = elevesDeLaClasse().length;
    const n = destinatairesRetenus().length;
    resume.textContent = modeDestinataires() === 'classe'
        ? `Toute la classe ${grade} — ${total} élève(s).`
        : `${n} élève(s) sélectionné(s) sur ${total} en ${grade}.`;
}

// Constants
const sections = document.querySelectorAll('.section');
const navItems = document.querySelectorAll('.nav-item');

// Salutation personnalisée selon l'utilisateur connecté et l'heure
function renderGreeting() {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('ideal_user') || 'null'); } catch(e) {}
    const h = new Date().getHours();
    const salut = h < 12 ? 'Bonjour' : (h < 18 ? 'Bon après-midi' : 'Bonsoir');
    const prenom = user && (user.prenom || (user.nom ? '' : '')) || '';
    const helloEl = document.getElementById('dash-hello');
    if (helloEl) helloEl.textContent = prenom ? `${salut}, ${prenom} 👋` : `${salut} 👋`;
    const dateEl = document.getElementById('dash-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Nom de l'enseignant connecté (pré-rempli automatiquement)
function currentTeacherName() {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('ideal_user') || 'null'); } catch(e) {}
    if (!user) return '';
    const nom = [user.prenom, user.nom].filter(Boolean).join(' ').trim();
    return nom || user.nom_complet || '';
}
function fillTeacherFromUser() {
    const el = document.getElementById('teacher-name');
    if (!el) return;
    let user = null;
    try { user = JSON.parse(localStorage.getItem('ideal_user') || 'null'); } catch(e) {}
    const name = currentTeacherName();
    if (name) { el.value = name; if (typeof updateLivePreview === 'function') updateLivePreview(); }
    // Un professeur ne peut pas changer le nom ; la direction/conseiller oui
    if (user && user.role === 'professeur') { el.readOnly = true; el.classList.add('locked-field'); }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('IDEAL Pédago-Archive v3.0 Initialized');
    renderGreeting();
    fillTeacherFromUser();
    updateStats();
    renderStudentList();
    renderArchive();
    setupEventListeners();
    loadSavedLogo();
    updateLivePreview();
});

function setupEventListeners() {
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section');
            switchSection(sectionId);
        });
    });

    // Logo Management
    const logoUpload = document.getElementById('logo-upload');
    if (logoUpload) logoUpload.addEventListener('change', handleLogoUpload);

    // Live Preview Inputs
    ['subject', 'grade-select', 'homework-type', 'homework-content', 'teacher-name', 'due-date', 'homework-period', 'homework-objectives'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateLivePreview);
    });

    // Changer de classe change la liste des élèves proposés
    const gradeSel = document.getElementById('grade-select');
    if (gradeSel) gradeSel.addEventListener('change', majDestinataires);

    // Save Homework
    const saveBtn = document.getElementById('save-homework-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveHomework);

    // Student Management
    const addStudentBtn = document.getElementById('add-student-btn');
    if (addStudentBtn) addStudentBtn.addEventListener('click', () => {
        document.getElementById('student-modal').style.display = 'flex';
    });

    const saveStudentBtn = document.getElementById('save-student-modal');
    if (saveStudentBtn) saveStudentBtn.addEventListener('click', addStudent);

    // CSV Import
    const csvUpload = document.getElementById('csv-upload');
    if (csvUpload) csvUpload.addEventListener('change', handleCSVUpload);

    // Homework File Upload
    const hwFile = document.getElementById('homework-file');
    if (hwFile) hwFile.addEventListener('change', handleHomeworkFileUpload);
}

function switchSection(id) {
    sections.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const targetSection = document.getElementById(id);
    const targetNav = document.querySelector(`[data-section="${id}"]`);
    
    if (targetSection) targetSection.classList.add('active');
    if (targetNav) targetNav.classList.add('active');
}

function updateLivePreview() {
    const subject = document.getElementById('subject').value || '__________';
    const grade = document.getElementById('grade-select').value || '__________';
    const type = document.getElementById('homework-type').value;
    const content = document.getElementById('homework-content').value;
    const teacher = document.getElementById('teacher-name').value || '__________';
    const dueDateRaw = document.getElementById('due-date').value;
    const dueDate = dueDateRaw ? new Date(dueDateRaw).toLocaleDateString('fr-FR') : '__________';
    
    // Update Header/Meta
    const previewSubject = document.getElementById('preview-subject');
    const previewTeacher = document.getElementById('preview-teacher');
    const previewGrade = document.getElementById('preview-grade');
    const previewType = document.getElementById('preview-type');
    const footerDueDate = document.getElementById('footer-due-date');

    if (previewSubject) previewSubject.innerText = subject.toUpperCase();
    if (previewTeacher) previewTeacher.innerText = teacher;
    if (previewGrade) previewGrade.innerText = grade;
    if (previewType) previewType.innerText = type.toUpperCase();
    if (footerDueDate) footerDueDate.innerText = `RENDU : ${dueDate}`;

    const contentArea = document.getElementById('preview-content');
    const imagesList = document.getElementById('preview-images-list');

    // Handle Text
    if (contentArea) {
        contentArea.innerText = content;
        contentArea.style.display = content ? 'block' : 'none';
    }

    // Handle Images
    if (imagesList) {
        imagesList.innerHTML = '';
        currentHomeworkImages.forEach(imgData => {
            const img = document.createElement('img');
            img.src = imgData;
            img.style.maxWidth = '100%';
            img.style.marginBottom = '20px';
            img.style.border = '1px solid #eee';
            imagesList.appendChild(img);
        });
    }
}

// Data Handling
function addStudent() {
    const nameInput = document.getElementById('modal-student-name');
    const gradeInput = document.getElementById('modal-student-grade');
    const name = nameInput.value.trim();
    const grade = gradeInput.value;

    if (!name) return alert('Veuillez entrer un nom');

    students.push({ id: Date.now(), name, grade });
    localStorage.setItem('ideal_students', JSON.stringify(students));
    
    nameInput.value = '';
    closeModal();
    renderStudentList();
    updateStats();
}

// Ordre officiel des classes IDEAL
const CLASS_ORDER = ['Petite Section','PS','Moyenne Section','MS','Grande Section','GS','CP1','CP2','CE1','CE2','CM1','CM2'];
function classRank(g) {
    const i = CLASS_ORDER.findIndex(c => c.toLowerCase() === String(g || '').toLowerCase());
    return i === -1 ? 99 : i;
}

// Palette d'accents par rang de classe (couleurs IDEAL)
const CLASS_COLORS = ['#8DC63F','#00B5B8','#F7941D','#1AAFE0','#EC008C','#ED1C24','#7E57C2','#00897B','#5C6BC0','#26A69A','#66BB6A','#EF5350'];
let _studentFilter = '';

function filterStudents(q) {
    _studentFilter = (q || '').toLowerCase().trim();
    renderStudentList();
}

function renderStudentList() {
    const wrap = document.getElementById('student-groups');
    if (!wrap) return;
    wrap.innerHTML = '';

    const totalEl = document.getElementById('students-total');
    if (totalEl) totalEl.textContent = students.length;

    if (!students.length) {
        wrap.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-graduate"></i>
                <p>Aucun élève pour le moment.</p>
                <span>Les élèves inscrits dans vos classes apparaîtront ici automatiquement.</span>
            </div>`;
        return;
    }

    // Grouper par classe, dans l'ordre officiel
    const groups = {};
    students.forEach(s => {
        const g = s.grade || 'Sans classe';
        (groups[g] = groups[g] || []).push(s);
    });

    const orderedClasses = Object.keys(groups).sort((a, b) => classRank(a) - classRank(b) || a.localeCompare(b));
    let anyVisible = false;

    orderedClasses.forEach(g => {
        let list = groups[g].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (_studentFilter) list = list.filter(s => (s.name || '').toLowerCase().includes(_studentFilter));
        if (!list.length) return;
        anyVisible = true;

        const color = CLASS_COLORS[classRank(g) % CLASS_COLORS.length] || 'var(--primary)';
        const collapsed = _studentFilter ? false : (localStorage.getItem('pedago_collapsed_' + g) === '1');

        const div = document.createElement('div');
        div.className = 'class-group' + (collapsed ? ' collapsed' : '');
        div.style.setProperty('--class-color', color);

        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'class-group-header';
        header.innerHTML = `
            <span class="cg-dot"></span>
            <span class="cg-name">${g}</span>
            <span class="count">${list.length}</span>
            <i class="fas fa-chevron-down cg-chevron"></i>`;
        header.onclick = () => {
            const now = !div.classList.contains('collapsed');
            div.classList.toggle('collapsed', now);
            localStorage.setItem('pedago_collapsed_' + g, now ? '1' : '0');
        };
        div.appendChild(header);

        const body = document.createElement('div');
        body.className = 'class-group-body';
        list.forEach((s, idx) => {
            const initials = (s.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
            const row = document.createElement('div');
            row.className = 'student-row';
            row.innerHTML = `
                <div class="s-num">${idx + 1}</div>
                <div class="avatar">${initials}</div>
                <div class="s-name">${s.name}</div>
                <i class="fas fa-chevron-right s-go"></i>
            `;
            body.appendChild(row);
        });
        div.appendChild(body);
        wrap.appendChild(div);
    });

    if (!anyVisible) {
        wrap.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>Aucun élève trouvé</p><span>pour « ${_studentFilter} »</span></div>`;
    }
}

function deleteStudent(id) {
    students = students.filter(s => s.id !== id);
    localStorage.setItem('ideal_students', JSON.stringify(students));
    renderStudentList();
    updateStats();
}

function loadHomework(id) {
    const h = homeworks.find(hw => hw.id === id);
    if (h) {
        document.getElementById('subject').value = h.subject;
        // Les devoirs archivés portent l'ancien code court (« PS », « GS ») ;
        // le menu propose désormais le nom complet. On retrouve l'option
        // correspondante au lieu de laisser le champ se vider.
        const selClasse = document.getElementById('grade-select');
        const opt = Array.from(selClasse.options).find(o => memeClasse(o.value, h.grade));
        selClasse.value = opt ? opt.value : '';
        document.getElementById('homework-type').value = h.type;
        document.getElementById('homework-content').value = h.content;
        document.getElementById('teacher-name').value = h.teacher || '';
        document.getElementById('due-date').value = h.dueDate || '';
        document.getElementById('homework-period').value = h.period || '1';
        document.getElementById('homework-objectives').value = h.objectives || '';
        document.getElementById('homework-bareme').value = h.bareme || '';
        currentHomeworkImages = h.images || [];
        updateLivePreview();
        majDestinataires();
        switchSection('composer');
    }
}

function saveHomework() {
    const teacher = document.getElementById('teacher-name').value;
    const subject = document.getElementById('subject').value;
    const grade = document.getElementById('grade-select').value;
    const type = document.getElementById('homework-type').value;
    const content = document.getElementById('homework-content').value;
    const dueDate = document.getElementById('due-date').value;
    const period = document.getElementById('homework-period').value;
    const objectives = document.getElementById('homework-objectives').value;
    const bareme = document.getElementById('homework-bareme').value;

    if (!subject || !grade || (!content && currentHomeworkImages.length === 0)) {
        return alert('Remplissez tous les champs !');
    }

    const newHomework = {
        id: Date.now(),
        subject,
        grade,
        type,
        content,
        teacher,
        dueDate,
        period,
        objectives,
        bareme,
        images: currentHomeworkImages,
        // Qui est concerné : toute la classe, ou les seuls élèves désignés.
        destinataires: modeDestinataires() === 'classe'
            ? { mode: 'classe' }
            : { mode: 'choix', eleves: destinatairesRetenus().map(s => ({ nom: s.name, cle: s.centralKey || null })) },
        date: new Date().toLocaleDateString('fr-FR')
    };

    homeworks.unshift(newHomework);
    localStorage.setItem('ideal_homeworks', JSON.stringify(homeworks));

    updateStats();
    renderArchive();
    showHomeworkPreview(); // aperçu + impression
}

// Aperçu du devoir créé (pages réelles), avec impression
function showHomeworkPreview() {
    const d = getHomeworkData();
    const nbEleves = students.filter(s => s.grade === d.grade).length;

    const overlay = document.createElement('div');
    overlay.className = 'preview-overlay';
    overlay.innerHTML = `
        <div class="preview-sheet">
            <div class="preview-head">
                <div class="preview-ok"><i class="fas fa-check-circle"></i> Devoir enregistré</div>
                <button class="preview-close" aria-label="Fermer"><i class="fas fa-times"></i></button>
            </div>
            <div class="preview-scroll" id="preview-scroll"></div>
            <div class="preview-actions">
                <button class="btn-print-one"><i class="fas fa-print"></i> Imprimer ce modèle</button>
                <button class="btn-print-all"><i class="fas fa-users"></i> Imprimer pour la classe${nbEleves ? ` (${nbEleves})` : ''}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    // Afficher les pages réelles du devoir (modèle sans nom)
    const scroll = overlay.querySelector('#preview-scroll');
    buildHomeworkPages(d, '').forEach(pg => { pg.style.display = 'flex'; scroll.appendChild(pg); });

    const close = () => overlay.remove();
    overlay.querySelector('.preview-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    overlay.querySelector('.btn-print-one').onclick = () => { close(); printSingle(); };
    overlay.querySelector('.btn-print-all').onclick = () => { close(); printAll(); };
}

let _archiveFilter = '';
function filterArchive(q) {
    _archiveFilter = (q || '').toLowerCase().trim();
    renderArchive();
}

function renderArchive() {
    const container = document.getElementById('archive-list-container');
    const recentList = document.getElementById('recent-list');
    const totalEl = document.getElementById('archive-total');
    if (totalEl) totalEl.textContent = homeworks.length;

    if (container) {
        container.innerHTML = '';
        let list = homeworks;
        if (_archiveFilter) {
            list = homeworks.filter(h =>
                [h.subject, h.grade, h.type].filter(Boolean).join(' ').toLowerCase().includes(_archiveFilter)
            );
        }
        if (homeworks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>Aucun devoir archivé</p>
                    <span>Créez un devoir : il apparaîtra ici automatiquement.</span>
                </div>`;
        } else if (list.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>Aucun résultat</p><span>pour « ${_archiveFilter} »</span></div>`;
        } else {
            const typeIcons = { 'Devoir de Maison': 'fa-book', 'Évaluation': 'fa-clipboard-check', 'Composition': 'fa-file-signature' };
            const typeClass = { 'Devoir de Maison': 'ico-blue', 'Évaluation': 'ico-orange', 'Composition': 'ico-purple' };
            list.forEach(h => {
                const card = document.createElement('div');
                card.className = 'archive-card animate-fade';
                card.innerHTML = `
                    <div class="a-icon ${typeClass[h.type] || 'ico-blue'}"><i class="fas ${typeIcons[h.type] || 'fa-book'}"></i></div>
                    <div class="a-main" onclick="loadHomework(${h.id})">
                        <div class="a-title">${h.subject || 'Sans matière'}</div>
                        <div class="a-meta">
                            <span class="chip chip-classe">${h.grade || '—'}</span>
                            <span class="chip chip-type">${h.type || 'Devoir'}</span>
                            <span class="chip chip-date"><i class="far fa-calendar"></i> ${h.date || ''}</span>
                        </div>
                    </div>
                    <div class="a-actions">
                        <button class="edit" onclick="loadHomework(${h.id})" aria-label="Modifier"><i class="fas fa-pen"></i></button>
                        <button class="del" onclick="deleteHomework(${h.id})" aria-label="Supprimer"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    }

    if (recentList) {
        recentList.innerHTML = '';
        if (homeworks.length === 0) {
            recentList.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Aucun devoir récent.</p>';
        } else {
            homeworks.slice(0, 3).forEach(h => {
                const div = document.createElement('div');
                div.style.padding = '10px 0';
                div.style.borderBottom = '1px solid var(--border)';
                div.innerHTML = `<strong>${h.subject}</strong> (${h.grade}) - ${h.date}`;
                recentList.appendChild(div);
            });
        }
    }
}

function deleteHomework(id) {
    if (!confirm('Supprimer ce devoir ?')) return;
    homeworks = homeworks.filter(h => h.id !== id);
    localStorage.setItem('ideal_homeworks', JSON.stringify(homeworks));
    renderArchive();
    updateStats();
}

function updateStats() {
    const sH = document.getElementById('stat-total-homework');
    const sS = document.getElementById('stat-total-students');
    const sC = document.getElementById('stat-total-classes');

    if (sH) sH.innerText = homeworks.length;
    if (sS) sS.innerText = students.length;
    if (sC) {
        const classes = [...new Set(students.map(s => s.grade))];
        sC.innerText = classes.length;
    }
}

// Récupère les données du formulaire de devoir
function getHomeworkData() {
    const dueRaw = document.getElementById('due-date').value;
    return {
        grade: document.getElementById('grade-select').value,
        subject: document.getElementById('subject').value,
        teacher: document.getElementById('teacher-name').value,
        period: document.getElementById('homework-period').value,
        objectives: document.getElementById('homework-objectives').value.trim(),
        bareme: document.getElementById('homework-bareme').value.trim(),
        type: document.getElementById('homework-type').value,
        content: document.getElementById('homework-content').value,
        dueDate: dueRaw ? new Date(dueRaw).toLocaleDateString('fr-FR') : '__________',
        images: currentHomeworkImages.slice()
    };
}

// Le SVG livré avec le site fait 2416x3007 : c'est un visuel en PORTRAIT.
// Le placer dans un bandeau horizontal l'étirait de plus de trois fois en
// largeur. Le PNG (1032x375) est la vraie version horizontale du logo.
function idealLogoSrc() {
    return localStorage.getItem('ideal_logo') || '/logo-ideal.png';
}

// Charge le logo et renvoie ses dimensions naturelles. On ne fixe jamais à la
// fois la largeur et la hauteur d'une image : html2canvas n'applique pas
// `object-fit`, donc toute boîte au mauvais rapport déforme le logo au lieu
// de le contenir. On calcule donc la largeur à partir de la hauteur voulue.
function mesurerLogo(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ l: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

// Bandeau d'en-tête commun (logo + école)
function schoolHeaderHTML(small) {
    const h = small ? 34 : 74;
    return `
        <div style="display:flex; align-items:center; gap:12px; ${small ? '' : 'justify-content:center; text-align:center; flex-direction:column;'}">
            <img src="${idealLogoSrc()}" style="height:${h}px; width:auto;" onerror="this.style.display='none'">
            ${small ? `<div style="line-height:1.1;">
                    <div style="font-weight:800; color:#0d2a3b; font-size:11pt;">IDEAL</div>
                    <div style="font-size:7pt; color:#c5a028; font-weight:700; letter-spacing:1px;">ÉCOLE INTERNATIONALE BILINGUE</div>
                 </div>`
              : `<div>
                    <div style="font-weight:800; color:#0d2a3b; font-size:15pt;">IDEAL ÉCOLE INTERNATIONALE</div>
                    <div style="font-size:8pt; color:#c5a028; font-weight:700; letter-spacing:2px;">BILINGUE — EXCELLENCE & RIGUEUR</div>
                 </div>`}
        </div>`;
}

// Construit toutes les pages d'un devoir pour un élève (nom vide = modèle)
function buildHomeworkPages(d, studentName) {
    const pages = [];
    const nameDisplay = studentName || '________________________________';

    // ── PAGE DE GARDE ──────────────────────────────────────
    const cover = document.createElement('div');
    cover.className = 'a4-page hw-page';
    cover.style.display = 'flex';
    cover.style.flexDirection = 'column';
    cover.innerHTML = `
        <div style="border-bottom:3px solid #0d2a3b; padding-bottom:14px; margin-bottom:20px;">
            ${schoolHeaderHTML(false)}
        </div>

        <div style="background:#0d2a3b; color:#fff; text-align:center; padding:10px; border-radius:8px; margin-bottom:18px;">
            <div style="font-size:15pt; font-weight:800; letter-spacing:1px;">${(d.type||'DEVOIR').toUpperCase()}</div>
            <div style="font-size:10pt; opacity:.85;">${d.subject ? d.subject.toUpperCase() : ''}</div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 20px; font-size:11pt; margin-bottom:20px;">
            <div><strong>Classe :</strong> ${d.grade || ''}</div>
            <div><strong>Période :</strong> ${d.period || ''}</div>
            <div><strong>Enseignant :</strong> ${d.teacher || ''}</div>
            <div><strong>Date de rendu :</strong> ${d.dueDate}</div>
        </div>

        ${d.objectives ? `
        <div style="margin-bottom:16px;">
            <div style="font-weight:800; color:#0d2a3b; font-size:11pt; border-left:4px solid #1AAFE0; padding-left:8px; margin-bottom:6px;">OBJECTIFS PÉDAGOGIQUES</div>
            <div style="font-size:11pt; line-height:1.5; white-space:pre-wrap;">${d.objectives}</div>
        </div>` : ''}

        <div style="margin-bottom:20px;">
            <div style="font-weight:800; color:#0d2a3b; font-size:11pt; border-left:4px solid #F7941D; padding-left:8px; margin-bottom:6px;">BARÈME DE CORRECTION</div>
            <div style="border:1.5px solid #0d2a3b; border-radius:8px; padding:12px 14px; font-size:11pt; line-height:1.6; white-space:pre-wrap; min-height:60px;">${d.bareme || 'Barème communiqué lors de la correction.'}</div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1.6fr; gap:14px; margin-bottom:22px;">
            <div style="border:1.5px solid #0d2a3b; border-radius:8px; text-align:center; padding:10px;">
                <div style="font-size:8pt; font-weight:700; color:#666;">NOTE</div>
                <div style="font-size:20pt; font-weight:800; padding-top:12px; color:#0d2a3b;">...... / 20</div>
            </div>
            <div style="border:1.5px solid #0d2a3b; border-radius:8px; padding:10px;">
                <div style="font-size:8pt; font-weight:700; color:#666; margin-bottom:14px;">APPRÉCIATION DE L'ENSEIGNANT</div>
                <div style="border-bottom:1px solid #cbd5e1; margin-bottom:16px;"></div>
                <div style="border-bottom:1px solid #cbd5e1;"></div>
            </div>
        </div>

        <div style="margin-top:auto; border:2px dashed #0d2a3b; border-radius:10px; padding:18px; text-align:center;">
            <div style="font-size:8pt; color:#666; margin-bottom:6px;">NOM ET PRÉNOMS DE L'ÉLÈVE</div>
            <div style="font-size:17pt; font-weight:800; color:#0d2a3b;">${nameDisplay}</div>
        </div>
    `;
    pages.push(cover);

    // ── PAGES DU DEVOIR ────────────────────────────────────
    const nbPages = Math.max(1, d.images.length);
    for (let p = 0; p < nbPages; p++) {
        const page = document.createElement('div');
        page.className = 'a4-page hw-page';
        page.style.display = 'flex';
        page.style.flexDirection = 'column';
        page.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #0d2a3b; padding-bottom:8px; margin-bottom:14px;">
                ${schoolHeaderHTML(true)}
                <div style="text-align:right; font-size:9pt; color:#475569;">
                    <div style="font-weight:700;">${(d.subject||'').toUpperCase()} — ${d.grade||''}</div>
                    <div>${d.type||''}</div>
                </div>
            </div>
            <div class="hw-body" style="flex:1; overflow:hidden;"></div>
            <!-- Le nom est volontairement gros en pied de page : c'est lui qui
                 permet de rendre une feuille égarée à son propriétaire. -->
            <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px; border-top:2px solid #0d2a3b; padding-top:8px; margin-top:12px; color:#0d2a3b;">
                <span style="font-size:8pt; font-weight:700; color:#64748b; flex-shrink:0;">ÉLÈVE</span>
                <span style="font-size:13pt; font-weight:800; flex:1; letter-spacing:.3px;">${(studentName || '____________________').toUpperCase()}</span>
                <span style="font-size:9pt; font-weight:700; flex-shrink:0;">Page ${p + 1} / ${nbPages}</span>
            </div>
        `;
        const body = page.querySelector('.hw-body');
        if (p === 0 && d.content) {
            const txt = document.createElement('div');
            txt.style.cssText = 'font-size:12pt; line-height:1.6; white-space:pre-wrap; margin-bottom:12px;';
            txt.innerText = d.content;
            body.appendChild(txt);
        }
        if (d.images[p]) {
            const img = document.createElement('img');
            img.src = d.images[p];
            img.style.cssText = `width:100%; height:auto; max-height:${(p === 0 && d.content) ? '215mm' : '250mm'}; object-fit:contain; display:block;`;
            body.appendChild(img);
        }
        pages.push(page);
    }
    return pages;
}

// Publipostage : un exemplaire nominatif par destinataire retenu
function printAll() {
    const d = getHomeworkData();
    if (!d.grade || (!d.content && d.images.length === 0)) {
        return alert('Veuillez sélectionner une classe et fournir le contenu.');
    }
    // Un devoir sans nom finit en feuille égarée que personne ne réclame.
    // On ne bascule donc jamais en version anonyme sans le dire franchement.
    let classStudents = destinatairesRetenus();
    if (classStudents.length === 0) {
        if (elevesDeLaClasse().length > 0) {
            // La classe a des élèves : l'enseignant a seulement oublié de les
            // cocher. Imprimer des feuilles vierges serait une erreur, pas un
            // choix — on refuse plutôt que de proposer.
            return alert(
                'Aucun élève sélectionné : le devoir s\'imprimerait sans nom.\n\n'
                + 'Cochez les élèves concernés, ou choisissez « Toute la classe ».'
            );
        }
        const ok = confirm(
            'Aucun élève trouvé en ' + d.grade + '.\n\n'
            + 'Les feuilles s\'imprimeront SANS NOM, à remplir à la main.\n'
            + 'Continuer quand même ?'
        );
        if (!ok) return;
        classStudents = [{ name: '' }];
    }
    const pc = document.getElementById('print-container');
    pc.innerHTML = '';
    classStudents.forEach(st => buildHomeworkPages(d, st.name).forEach(pg => pc.appendChild(pg)));
    window.print();
}

// Impression d'un seul exemplaire modèle (sans nom d'élève)
function printSingle() {
    const d = getHomeworkData();
    if (!d.grade || (!d.content && d.images.length === 0)) {
        return alert('Veuillez sélectionner une classe et fournir le contenu.');
    }
    const pc = document.getElementById('print-container');
    pc.innerHTML = '';
    buildHomeworkPages(d, '').forEach(pg => pc.appendChild(pg));
    window.print();
}

// ═══════════════ MESSAGE ILLUSTRÉ AUX PARENTS ═══════════════
// Carte portrait (~640 px, ratio proche de 1:1,9) : la quasi-totalité des
// parents la reçoivent sur téléphone. Même principe que le rapport
// hebdomadaire et les relances de recouvrement : image partagée en natif,
// repli téléchargement + wa.me sans destinataire pré-rempli.

const MSG_LARGEUR = 640;
// Numéro WhatsApp officiel d'IDEAL : l'enseignant envoie la carte à l'école,
// qui la relaie ensuite aux parents. Même destinataire que les rapports
// hebdomadaires (IDEAL_WA dans rapports.html).
const IDEAL_WA = '22390190007';

// html2canvas ne capture pas une image non décodée : on attend chaque <img>
// avant la capture. Chaque attente est bornée — une image qui finissait de
// charger juste avant qu'on attache l'écouteur laissait la promesse en
// suspens, et la génération se figeait sans le moindre message.
function attendreImages(el, limiteMs = 8000) {
    const images = Array.from(el.querySelectorAll('img'));
    return Promise.all(images.map(img => {
        const pret = new Promise(resolve => {
            const fini = () => resolve();
            // Une image déjà chargée est exploitable telle quelle. Ne pas
            // appeler `decode()` dessus : en arrière-plan d'onglet, l'appel
            // ne se termine jamais et bloquait la génération.
            if (img.complete && img.naturalWidth) { resolve(); return; }
            img.addEventListener('load', fini, { once: true });
            img.addEventListener('error', fini, { once: true });
        });
        return Promise.race([pret, new Promise(r => setTimeout(r, limiteMs))]);
    }));
}

// Vignette d'une page. Comme pour le logo, on ne contraint jamais les deux
// dimensions d'une photo : `object-fit` n'est pas appliqué par html2canvas,
// et une image forcée en 56x78 en sortait étirée. La largeur est imposée,
// la hauteur suit, et le cadre rogne le débordement.
const VIGN_L = 56, VIGN_H = 78;
const cadreVignette = contenu =>
    `<div style="width:${VIGN_L}px;height:${VIGN_H}px;border:1px solid #cbd5e1;border-radius:4px;
          background:#fff;overflow:hidden;">${contenu}</div>`;

function vignettePageHTML(d, index) {
    if (index === 0) {
        return cadreVignette(`
            <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
                <div style="width:32px;height:4px;background:#0d2a3b;border-radius:2px;"></div>
                <div style="width:40px;height:11px;background:#0d2a3b;border-radius:2px;"></div>
                <div style="width:38px;height:3px;background:#cbd5e1;"></div>
                <div style="width:38px;height:3px;background:#cbd5e1;"></div>
                <div style="width:28px;height:3px;background:#cbd5e1;"></div>
            </div>`);
    }
    const img = d.images[index - 1];
    if (img) {
        return cadreVignette(`<img src="${img}" style="width:${VIGN_L}px;height:auto;display:block;">`);
    }
    return cadreVignette(`
        <div style="height:100%;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:0 8px;">
            ${'<div style="height:3px;background:#cbd5e1;"></div>'.repeat(6)}
        </div>`);
}

// Tableau minimaliste des pages : une ligne par page, vignette + intitulé.
function tableauPagesHTML(d) {
    const nbExercices = Math.max(1, d.images.length);
    const lignes = [];
    lignes.push({ i: 0, titre: 'Page de garde', detail: 'Nom, barème, note' });
    for (let p = 1; p <= nbExercices; p++) {
        const aImage = !!d.images[p - 1];
        lignes.push({
            i: p,
            titre: 'Page ' + p,
            detail: aImage ? 'Exercices' : (d.content ? 'Énoncé écrit' : 'Exercices')
        });
    }
    return `
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
            <tr style="background:#0d2a3b; color:#fff;">
                <th style="text-align:left; padding:8px 12px; font-size:11px; letter-spacing:.6px; font-weight:800;">APERÇU</th>
                <th style="text-align:left; padding:8px 12px; font-size:11px; letter-spacing:.6px; font-weight:800;">PAGE</th>
                <th style="text-align:left; padding:8px 12px; font-size:11px; letter-spacing:.6px; font-weight:800;">CONTENU</th>
            </tr>
        </thead>
        <tbody>
            ${lignes.map((l, k) => `
            <tr style="background:${k % 2 ? '#f6f9fb' : '#fff'};">
                <td style="padding:8px 12px; border-bottom:1px solid #e5eaf0;">${vignettePageHTML(d, l.i)}</td>
                <td style="padding:8px 12px; border-bottom:1px solid #e5eaf0; font-weight:700; color:#0d2a3b;">${l.titre}</td>
                <td style="padding:8px 12px; border-bottom:1px solid #e5eaf0; color:#475569;">${l.detail}</td>
            </tr>`).join('')}
        </tbody>
    </table>
    <div style="text-align:center; font-size:12px; color:#6b7280; padding:8px 0 0;">
        ${lignes.length} page(s) au total — la version papier est remise à l'élève.
    </div>`;
}

function carteMessageHTML(d, destinataires, dimsLogo) {
    // Hauteur voulue pour le logo ; la largeur suit le rapport réel du
    // fichier. Repli sur les proportions du PNG horizontal si la mesure a
    // échoué, jamais sur une boîte arbitraire qui déformerait l'image.
    const HAUTEUR_LOGO = 58;
    const rapport = dimsLogo && dimsLogo.h ? dimsLogo.l / dimsLogo.h : (1032 / 375);
    const logo = { h: HAUTEUR_LOGO, l: Math.round(HAUTEUR_LOGO * rapport) };

    const mode = modeDestinataires();
    const listeNoms = destinataires.map(s => s.name).filter(Boolean);
    const pourQui = mode === 'classe'
        ? `Toute la classe de <b>${d.grade}</b>`
        : (listeNoms.length <= 3
            ? `Concerne : <b>${listeNoms.join(', ')}</b>`
            : `Concerne <b>${listeNoms.length} élèves</b> de ${d.grade}`);

    return `
    <div style="width:${MSG_LARGEUR}px; background:#fff; font-family:system-ui,-apple-system,'Segoe UI',sans-serif; color:#0d2a3b;">

        <div style="background:linear-gradient(135deg,#0d2a3b 0%,#1d5f80 100%); padding:26px 30px 22px; text-align:center;">
            <img src="${idealLogoSrc()}" width="${logo.l}" height="${logo.h}"
                 style="width:${logo.l}px;height:${logo.h}px;display:block;margin:0 auto;background:#fff;border-radius:14px;padding:10px 18px;box-sizing:content-box;">
            <div style="color:#fff; font-size:27px; font-weight:800; margin-top:16px; letter-spacing:-.4px;">Devoir de maison</div>
            <div style="color:#bcd8e8; font-size:12px; letter-spacing:1.6px; margin-top:5px; font-weight:600;">ÉCOLE INTERNATIONALE BILINGUE IDEAL · BAMAKO</div>
            <div style="display:inline-block; background:#F7941D; color:#fff; font-weight:800; font-size:15px; padding:9px 22px; border-radius:22px; margin-top:16px;">
                À rendre le ${d.dueDate}
            </div>
        </div>

        <div style="padding:24px 30px 8px;">
            <div style="font-size:15px; line-height:1.55; color:#334155;">
                Chers parents, un <b>${(d.type || 'devoir').toLowerCase()}</b> de
                <b>${d.subject || '—'}</b> a été donné aujourd'hui.
                Merci d'accompagner votre enfant pour qu'il le rende à temps.
            </div>
        </div>

        <div style="padding:16px 30px 0;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div style="background:#f3f7fa; border-radius:12px; padding:13px 15px;">
                    <div style="font-size:10px; font-weight:800; color:#7c8ea0; letter-spacing:1px;">MATIÈRE</div>
                    <div style="font-size:17px; font-weight:800; margin-top:3px;">${d.subject || '—'}</div>
                </div>
                <div style="background:#f3f7fa; border-radius:12px; padding:13px 15px;">
                    <div style="font-size:10px; font-weight:800; color:#7c8ea0; letter-spacing:1px;">CLASSE</div>
                    <div style="font-size:17px; font-weight:800; margin-top:3px;">${d.grade || '—'}</div>
                </div>
            </div>
            <div style="background:#eef7ee; border-left:4px solid #2e9e4f; border-radius:0 10px 10px 0; padding:12px 15px; margin-top:12px; font-size:14px;">
                ${pourQui}
            </div>
        </div>

        ${d.objectives ? `
        <div style="padding:16px 30px 0;">
            <div style="font-size:11px; font-weight:800; color:#7c8ea0; letter-spacing:1.1px; margin-bottom:6px;">CE QUI EST TRAVAILLÉ</div>
            <div style="font-size:14px; line-height:1.5; color:#334155;">${d.objectives}</div>
        </div>` : ''}

        <div style="padding:20px 30px 0;">
            <div style="font-size:11px; font-weight:800; color:#7c8ea0; letter-spacing:1.1px; margin-bottom:8px;">CE QUE CONTIENT LE DEVOIR</div>
            <div style="border:1px solid #e5eaf0; border-radius:10px; overflow:hidden;">
                ${tableauPagesHTML(d)}
            </div>
        </div>

        <div style="padding:20px 30px 26px;">
            <div style="background:#0d2a3b; border-radius:12px; padding:16px 18px; color:#fff; text-align:center;">
                <div style="font-size:13px; color:#bcd8e8;">Enseignant</div>
                <div style="font-size:17px; font-weight:800; margin-top:2px;">${d.teacher || '—'}</div>
                <div style="font-size:12px; color:#95b4c8; margin-top:8px;">Pour toute question, contactez l'école.</div>
            </div>
        </div>
    </div>`;
}

let msgDernierBlob = null;

async function ouvrirMessageParents() {
    const d = getHomeworkData();
    if (!d.grade || !d.subject || (!d.content && d.images.length === 0)) {
        return alert('Renseignez au moins la classe, la matière et le contenu du devoir avant de prévenir les parents.');
    }
    // Sans date de remise, la carte annonce « À rendre le ______ » aux
    // parents : un document incomplet ne doit pas quitter l'école.
    if (!document.getElementById('due-date').value) {
        return alert('Indiquez la date de remise : sans elle, les parents recevraient un message sans échéance.');
    }
    const dest = destinatairesRetenus();
    if (modeDestinataires() === 'choix' && dest.length === 0) {
        return alert('Aucun élève sélectionné : cochez les élèves concernés ou choisissez « Toute la classe ».');
    }

    const stage = document.getElementById('msg-stage');
    const dimsLogo = await mesurerLogo(idealLogoSrc());
    stage.innerHTML = carteMessageHTML(d, dest, dimsLogo);
    document.getElementById('msg-apercu').innerHTML =
        `<div style="transform-origin:top left; width:${MSG_LARGEUR}px;">${stage.innerHTML}</div>`;
    // Afficher AVANT de mesurer : sur un conteneur encore masqué, clientWidth
    // vaut 0 et l'aperçu serait réduit à néant.
    document.getElementById('msg-modal').style.display = 'block';
    ajusterApercuMessage();

    msgDernierBlob = null;
    try { msgDernierBlob = await carteMessageEnBlob(); } catch (e) { console.warn('Rendu de la carte impossible:', e); }
}

// L'aperçu est rendu à 640 px puis mis à l'échelle : la carte envoyée reste
// identique quelle que soit la largeur de l'écran de l'enseignant.
function ajusterApercuMessage() {
    const boite = document.getElementById('msg-apercu');
    if (!boite || !boite.firstElementChild) return;
    const dispo = boite.clientWidth || MSG_LARGEUR;
    const k = Math.min(1, dispo / MSG_LARGEUR);
    boite.firstElementChild.style.transform = `scale(${k})`;
    boite.style.height = (boite.firstElementChild.scrollHeight * k) + 'px';
    boite.style.overflow = 'hidden';
}

async function carteMessageEnBlob() {
    const stage = document.getElementById('msg-stage');
    const cible = stage.firstElementChild;
    await attendreImages(stage);
    // Laisser au navigateur le temps de peindre. Pas de requestAnimationFrame :
    // il ne se déclenche pas si l'onglet passe en arrière-plan.
    await new Promise(r => setTimeout(r, 60));
    const canvas = await html2canvas(cible, {
        scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false,
        width: MSG_LARGEUR, windowWidth: MSG_LARGEUR, imageTimeout: 0
    });
    // PNG et non JPEG : le document part chez les parents, la netteté du
    // texte prime sur le poids du fichier. Le JPEG, même à 0,92, adoucit les
    // contours des lettres et laisse un halo autour des aplats sombres.
    // 1920 px de large : la carte reste nette même agrandie sur l'écran.
    return new Promise(r => canvas.toBlob(r, 'image/png'));
}

function nomFichierMessage() {
    const d = getHomeworkData();
    const net = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-');
    return `devoir-${net(d.grade)}-${net(d.subject)}.png`;
}

function legendeMessage() {
    const d = getHomeworkData();
    return `📚 ${d.type || 'Devoir'} de ${d.subject || ''} — classe de ${d.grade || ''}. À rendre le ${d.dueDate}. (École IDEAL)`;
}

async function envoyerMessageParents() {
    if (!msgDernierBlob) {
        try { msgDernierBlob = await carteMessageEnBlob(); }
        catch (e) { return alert("L'image n'a pas pu être générée."); }
    }
    const fichier = new File([msgDernierBlob], nomFichierMessage(), { type: 'image/png' });
    const legende = legendeMessage();

    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
        try { await navigator.share({ files: [fichier], text: legende }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
    }
    // Repli : on télécharge l'image, puis WhatsApp s'ouvre sur le numéro de
    // l'école, qui relaie ensuite aux parents.
    telechargerMessageParents();
    window.open('https://wa.me/' + IDEAL_WA + '?text=' + encodeURIComponent(legende + "\n(joindre l'image téléchargée)"), '_blank');
}

function telechargerMessageParents() {
    if (!msgDernierBlob) return alert("L'image n'est pas encore prête.");
    const a = document.createElement('a');
    a.href = URL.createObjectURL(msgDernierBlob);
    a.download = nomFichierMessage();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function fermerMessageParents() {
    document.getElementById('msg-modal').style.display = 'none';
}

window.addEventListener('resize', () => {
    if (document.getElementById('msg-modal').style.display === 'block') ajusterApercuMessage();
});

function closeModal() {
    const modal = document.getElementById('student-modal');
    if (modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('student-modal');
    if (event.target == modal) closeModal();
}

function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target.result;
        localStorage.setItem('ideal_logo', base64);
        applyLogo(base64);
    };
    reader.readAsDataURL(file);
}

function loadSavedLogo() {
    const savedLogo = localStorage.getItem('ideal_logo');
    if (savedLogo) applyLogo(savedLogo);
}

function applyLogo(base64) {
    if (!base64) return;
    console.log('Applying Logo...');
    const sidebarContent = document.getElementById('sidebar-logo-content');
    const previewLogo = document.getElementById('preview-logo');
    const textHeader = document.getElementById('school-text-header');
    
    if (sidebarContent) {
        sidebarContent.innerHTML = `<img src="${base64}" style="max-height: 80px; width: auto; object-fit: contain;">`;
    }
    
    if (previewLogo) {
        previewLogo.src = base64;
        previewLogo.style.display = 'block';
    }
    
    if (textHeader) {
        textHeader.style.display = 'block';
    }
}

function exportData() {
    const data = {
        students,
        homeworks,
        logo: localStorage.getItem('ideal_logo')
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ideal_backup_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.json`;
    a.click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.students) students = data.students;
            if (data.homeworks) homeworks = data.homeworks;
            if (data.logo) localStorage.setItem('ideal_logo', data.logo);
            
            localStorage.setItem('ideal_students', JSON.stringify(students));
            localStorage.setItem('ideal_homeworks', JSON.stringify(homeworks));
            
            alert('Données restaurées !');
            location.reload();
        } catch (err) {
            alert('Erreur importation.');
        }
    };
    reader.readAsText(file);
}

function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const rows = text.split('\n');
        let addedCount = 0;

        rows.forEach(row => {
            const columns = row.split(/,|;/);
            if (columns.length >= 2) {
                const name = columns[0].trim().replace(/"/g, '');
                const grade = columns[1].trim().toUpperCase().replace(/"/g, '');
                if (name && name !== 'NOM' && name !== 'NAME') {
                    students.push({ id: Date.now() + Math.random(), name, grade });
                    addedCount++;
                }
            }
        });

        localStorage.setItem('ideal_students', JSON.stringify(students));
        renderStudentList();
        updateStats();
        alert(`${addedCount} élèves importés !`);
    };
    reader.readAsText(file);
}

function handleHomeworkFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentHomeworkImages.push(event.target.result);
            updateLivePreview();
        };
        reader.readAsDataURL(file);
    });
}

function clearHomeworkContent() {
    document.getElementById('homework-content').value = '';
    currentHomeworkImages = [];
    document.getElementById('homework-file').value = '';
    updateLivePreview();
}

// ═══════════════════════════════════════════════════════════════
// SYNCHRONISATION SUPABASE — source de données unique IDEAL
//
// • Élèves : proviennent UNIQUEMENT de la base centrale (tables
//   `eleves` + `inscriptions`). Un prof ne voit que les élèves des
//   classes qui lui sont affectées (table `prof_classes`). La
//   direction et les conseillers voient toutes les classes.
// • Devoirs et logo : partagés via la table `app_state`.
// ═══════════════════════════════════════════════════════════════
(function(){
    const SB_URL = 'https://jircuneixzwsmtktxrkh.supabase.co';
    const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppcmN1bmVpeHp3c210a3R4cmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzI0ODQsImV4cCI6MjA4Nzc0ODQ4NH0.MLAV60tPKhFP8BixVavW3SU-npe8YvS0lKQ493AYNls';
    const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
    const KEYS = ['ideal_homeworks', 'ideal_logo']; // les élèves ne sont plus stockés localement
    const last = {};

    function parseVal(raw) { try { return JSON.parse(raw); } catch(e) { return raw; } }

    // Push : devoirs et logo vers app_state
    setInterval(() => {
        KEYS.forEach(k => {
            const v = localStorage.getItem(k);
            if (v !== null && v !== last[k]) {
                last[k] = v;
                fetch(SB_URL + '/rest/v1/app_state', {
                    method: 'POST',
                    headers: { ...H, Prefer: 'resolution=merge-duplicates' },
                    body: JSON.stringify({ app: 'pedago', key: k, value: parseVal(v), updated_at: new Date().toISOString() })
                }).catch(() => {});
            }
        });
    }, 2500);

    (async () => {
        try {
            // 1) Devoirs + logo partagés
            const r = await fetch(SB_URL + '/rest/v1/app_state?app=eq.pedago&select=key,value', { headers: H });
            if (r.ok) {
                (await r.json()).forEach(({ key, value }) => {
                    if (!KEYS.includes(key)) return;
                    const nv = typeof value === 'string' ? value : JSON.stringify(value);
                    last[key] = nv;
                    localStorage.setItem(key, nv);
                });
            }

            // 2) Périmètre de classes selon le rôle de l'utilisateur connecté
            let user = null;
            try { user = JSON.parse(localStorage.getItem('ideal_user') || 'null'); } catch(e) {}
            const role = user && user.role;
            let allowedClassIds = null;   // null = toutes (direction / conseiller)
            let allowedClassNames = null; // null = toutes

            if (role === 'professeur' && user.id) {
                allowedClassIds = new Set();
                allowedClassNames = new Set();
                const pc = await fetch(SB_URL + '/rest/v1/prof_classes?user_id=eq.' + encodeURIComponent(user.id) + '&select=classe_id,classes(id,nom)', { headers: H });
                if (pc.ok) {
                    (await pc.json()).forEach(row => {
                        if (row.classe_id != null) allowedClassIds.add(String(row.classe_id));
                        const nm = row.classes && row.classes.nom;
                        if (nm) { allowedClassNames.add(nm.toLowerCase()); classesAutorisees.push(nm); }
                    });
                }
            } else {
                // Direction et conseiller : toutes les classes de l'établissement
                const cr = await fetch(SB_URL + '/rest/v1/classes?select=nom&order=nom', { headers: H });
                if (cr.ok) (await cr.json()).forEach(c => { if (c.nom) classesAutorisees.push(c.nom); });
            }
            remplirClasses();

            const inScope = (classeId, classeNom) => {
                if (!allowedClassIds) return true; // direction / conseiller : tout
                if (classeId != null && allowedClassIds.has(String(classeId))) return true;
                if (classeNom && allowedClassNames.has(String(classeNom).toLowerCase())) return true;
                return false;
            };

            // 3) Reconstruire la liste des élèves depuis la base centrale
            const list = [];
            const seen = new Set();
            const add = (full, cn, key) => {
                if (!full) return;
                const dedup = (full.toLowerCase() + '|' + (cn || '').toLowerCase());
                if (seen.has(dedup)) return;
                seen.add(dedup);
                list.push({ id: Date.now() + Math.floor(Math.random() * 1e6), centralKey: key, name: full, grade: cn });
            };

            const er = await fetch(SB_URL + '/rest/v1/eleves?actif=eq.true&select=id,prenom,nom,classe_id,classes(nom)', { headers: H });
            if (er.ok) {
                (await er.json()).forEach(e => {
                    const cn = (e.classes && e.classes.nom) || '';
                    if (inScope(e.classe_id, cn)) add(((e.prenom || '') + ' ' + (e.nom || '')).trim(), cn, 'el:' + e.id);
                });
            }
            const ir = await fetch(SB_URL + '/rest/v1/inscriptions?select=matricule,prenom,nom,classe_demandee', { headers: H });
            if (ir.ok) {
                (await ir.json()).forEach(e => {
                    const cn = e.classe_demandee || '';
                    if (inScope(null, cn)) add(((e.prenom || '') + ' ' + (e.nom || '')).trim(), cn, 'ins:' + e.matricule);
                });
            }

            students = list;
            homeworks = JSON.parse(localStorage.getItem('ideal_homeworks')) || [];
            if (typeof majDestinataires === 'function') majDestinataires();
            if (typeof renderStudentList === 'function') renderStudentList();
            if (typeof renderArchive === 'function') renderArchive();
            if (typeof updateStats === 'function') updateStats();
            if (typeof loadSavedLogo === 'function') loadSavedLogo();
        } catch(e) { console.warn('Sync Supabase indisponible:', e); }
    })();
})();
