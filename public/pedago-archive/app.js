// State Management
let students = JSON.parse(localStorage.getItem('ideal_students')) || [];
let homeworks = JSON.parse(localStorage.getItem('ideal_homeworks')) || [];
let currentHomeworkImages = [];

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
        document.getElementById('grade-select').value = h.grade;
        document.getElementById('homework-type').value = h.type;
        document.getElementById('homework-content').value = h.content;
        document.getElementById('teacher-name').value = h.teacher || '';
        document.getElementById('due-date').value = h.dueDate || '';
        document.getElementById('homework-period').value = h.period || '1';
        document.getElementById('homework-objectives').value = h.objectives || '';
        document.getElementById('homework-bareme').value = h.bareme || '';
        currentHomeworkImages = h.images || [];
        updateLivePreview();
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

function renderArchive() {
    const container = document.getElementById('archive-list-container');
    const recentList = document.getElementById('recent-list');
    
    if (container) {
        container.innerHTML = '';
        if (homeworks.length === 0) {
            container.innerHTML = '<p>Aucun devoir archivé.</p>';
        } else {
            const typeIcons = { 'Devoir de Maison': 'fa-book', 'Évaluation': 'fa-clipboard-check', 'Composition': 'fa-file-signature' };
            homeworks.forEach(h => {
                const card = document.createElement('div');
                card.className = 'archive-card animate-fade';
                card.innerHTML = `
                    <div class="a-icon"><i class="fas ${typeIcons[h.type] || 'fa-book'}"></i></div>
                    <div class="a-main">
                        <div class="a-title">${h.subject || 'Sans matière'}</div>
                        <div class="a-meta">
                            <span class="chip chip-classe">${h.grade || '—'}</span>
                            <span class="chip chip-type">${h.type || 'Devoir'}</span>
                            <span class="chip chip-date">${h.date || ''}</span>
                        </div>
                    </div>
                    <div class="a-actions">
                        <button class="edit" onclick="loadHomework(${h.id})" aria-label="Modifier"><i class="fas fa-edit"></i></button>
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

function idealLogoSrc() {
    return localStorage.getItem('ideal_logo') || '/logo-ideal.svg';
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
            <div style="display:flex; justify-content:space-between; align-items:center; border-top:2px solid #0d2a3b; padding-top:8px; margin-top:12px; font-size:9pt; font-weight:700; color:#0d2a3b;">
                <span>ÉLÈVE : ${(studentName || '____________________').toUpperCase()}</span>
                <span>Page ${p + 1} / ${nbPages}</span>
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

// Publipostage : un exemplaire nominatif par élève de la classe
function printAll() {
    const d = getHomeworkData();
    if (!d.grade || (!d.content && d.images.length === 0)) {
        return alert('Veuillez sélectionner une classe et fournir le contenu.');
    }
    let classStudents = students.filter(s => s.grade === d.grade);
    if (classStudents.length === 0) {
        if (!confirm('Aucun élève en ' + d.grade + '. Imprimer une version vierge ?')) return;
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
                        if (nm) allowedClassNames.add(nm.toLowerCase());
                    });
                }
            }

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
            if (typeof renderStudentList === 'function') renderStudentList();
            if (typeof renderArchive === 'function') renderArchive();
            if (typeof updateStats === 'function') updateStats();
            if (typeof loadSavedLogo === 'function') loadSavedLogo();
        } catch(e) { console.warn('Sync Supabase indisponible:', e); }
    })();
})();
