// State Management
let students = JSON.parse(localStorage.getItem('ideal_students')) || [];
let homeworks = JSON.parse(localStorage.getItem('ideal_homeworks')) || [];
let currentHomeworkImages = [];

// Constants
const sections = document.querySelectorAll('.section');
const navItems = document.querySelectorAll('.nav-item');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('IDEAL Pédago-Archive v3.0 Initialized');
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

function renderStudentList() {
    const body = document.getElementById('student-list-body');
    if (!body) return;
    body.innerHTML = '';

    students.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.name}</td>
            <td>${s.grade}</td>
            <td>
                <button class="btn" style="color: red;" onclick="deleteStudent(${s.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        body.appendChild(tr);
    });
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
        images: currentHomeworkImages,
        date: new Date().toLocaleDateString('fr-FR')
    };

    homeworks.unshift(newHomework);
    localStorage.setItem('ideal_homeworks', JSON.stringify(homeworks));
    
    alert('Devoir enregistré !');
    updateStats();
    renderArchive();
    switchSection('archive');
}

function renderArchive() {
    const container = document.getElementById('archive-list-container');
    const recentList = document.getElementById('recent-list');
    
    if (container) {
        container.innerHTML = '';
        if (homeworks.length === 0) {
            container.innerHTML = '<p>Aucun devoir archivé.</p>';
        } else {
            homeworks.forEach(h => {
                const card = document.createElement('div');
                card.className = 'card animate-fade';
                card.style.display = 'flex';
                card.style.justifyContent = 'space-between';
                card.style.alignItems = 'center';
                card.style.marginBottom = '10px';
                
                card.innerHTML = `
                    <div>
                        <strong style="color: var(--primary);">${h.subject}</strong> - ${h.grade} 
                        <span style="font-size: 0.8rem; color: var(--text-muted);">(${h.date})</span>
                    </div>
                    <div>
                        <button class="btn btn-secondary" onclick="loadHomework(${h.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn" style="color: red;" onclick="deleteHomework(${h.id})">
                            <i class="fas fa-trash"></i>
                        </button>
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

function printAll() {
    const grade = document.getElementById('grade-select').value;
    const subject = document.getElementById('subject').value;
    const teacher = document.getElementById('teacher-name').value;
    const period = document.getElementById('homework-period').value;
    const objectives = document.getElementById('homework-objectives').value || 'Non spécifiés';
    const type = document.getElementById('homework-type').value;
    const content = document.getElementById('homework-content').value;
    const dueDateRaw = document.getElementById('due-date').value;
    const dueDate = dueDateRaw ? new Date(dueDateRaw).toLocaleDateString('fr-FR') : '__________';

    if (!grade || (!content && currentHomeworkImages.length === 0)) {
        return alert('Veuillez sélectionner une classe et fournir le contenu.');
    }

    const classStudents = students.filter(s => s.grade === grade);
    if (classStudents.length === 0) {
        if (!confirm('Aucun élève en ' + grade + '. Imprimer version vierge ?')) return;
        classStudents.push({ name: '________________________________________' });
    }

    const printContainer = document.getElementById('print-container');
    printContainer.innerHTML = '';
    const logoBase64 = localStorage.getItem('ideal_logo');

    for (let s = 0; s < classStudents.length; s++) {
        const student = classStudents[s];
        
        // 1. GENERATE COVER PAGE (STRICT IMAGE 1 STYLE)
        const coverPage = document.createElement('div');
        coverPage.className = 'a4-page cover-page';
        coverPage.style.display = 'block';
        coverPage.style.textAlign = 'center';
        
        coverPage.innerHTML = `
            <div style="padding-top: 5mm; margin-bottom: 25mm;">
                ${logoBase64 ? `<img src="${logoBase64}" style="max-height: 100px; display: block; margin: 0 auto 15px auto;">` : ''}
                <h1 style="color: #1a237e; font-size: 1.8rem; margin: 0; font-weight: 700;">IDEAL ÉCOLE INTERNATIONALE</h1>
                <p style="color: #c5a028; font-weight: 700; letter-spacing: 2px; margin: 5px 0 0 0; font-size: 0.8rem;">BILINGUE - EXCELLENCE & RIGUEUR</p>
            </div>
            
            <div style="border: 2px solid #1a237e; padding: 20px; margin-bottom: 25px; background: #fff; width: 100%; box-sizing: border-box;">
                <h2 style="text-align: center; text-decoration: underline; margin-bottom: 20px; font-size: 1.3rem; color: #1a237e;">${type.toUpperCase()}</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left; font-size: 1rem; color: #000;">
                    <div><strong>MATIÈRE :</strong> ${subject.toUpperCase()}</div>
                    <div><strong>CLASSE :</strong> ${grade}</div>
                    <div><strong>PÉRIODE :</strong> ${period}</div>
                    <div><strong>EFFECTIF :</strong> ${classStudents.length} élèves</div>
                    <div><strong>ENSEIGNANT :</strong> ${teacher}</div>
                    <div><strong>DATE DE RENDU :</strong> ${dueDate}</div>
                </div>
            </div>
            
            <div style="text-align: left; margin-bottom: 25px; padding: 0 10px;">
                <h3 style="font-size: 1rem; text-decoration: underline; margin-bottom: 10px; color: #1a237e;">OBJECTIFS PÉDAGOGIQUES :</h3>
                <p style="font-size: 1rem; line-height: 1.4; margin: 0; color: #000;">${objectives}</p>
            </div>

            <!-- CLEAN GRADING SECTION -->
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px; margin-bottom: 30px; width: 100%; box-sizing: border-box;">
                <div style="border: 1.5px solid #1a237e; padding: 10px; text-align: center;">
                    <div style="font-size: 0.7rem; font-weight: 700; margin-bottom: 5px; color: #666; background: #f8fafc;">NOTE / RÉSULTAT</div>
                    <div style="font-size: 1.5rem; font-weight: 400; padding: 10px 0;">.......... / ..........</div>
                </div>
                <div style="border: 1.5px solid #1a237e; padding: 10px; text-align: left;">
                    <div style="font-size: 0.7rem; font-weight: 700; margin-bottom: 5px; color: #666; background: #f8fafc;">OBSERVATIONS / APPRÉCIATION</div>
                    <div style="border-bottom: 1px solid #ddd; margin-top: 15px; height: 1px;"></div>
                    <div style="border-bottom: 1px solid #ddd; margin-top: 20px; height: 1px;"></div>
                </div>
            </div>
            
            <div style="border: 2px dashed #1a237e; padding: 25px; margin-top: auto; text-align: center;">
                <span style="font-size: 0.7rem; color: #666; display: block; margin-bottom: 10px;">NOM et Prénoms</span>
                <div style="font-size: 1.8rem; font-weight: 800; color: #1a237e;">${student.name}</div>
            </div>
        `;
        printContainer.appendChild(coverPage);

        // 2. GENERATE EXERCISE PAGES
        const totalExPages = Math.max(1, currentHomeworkImages.length);
        for (let p = 0; p < totalExPages; p++) {
            const exPage = document.createElement('div');
            exPage.className = 'a4-page';
            exPage.style.display = 'block';
            exPage.style.padding = '10mm';
            
            exPage.innerHTML = `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; margin-bottom: 10px; font-size: 0.8rem; color: #94a3b8;">
                    <span>${subject.toUpperCase()} - ${grade}</span>
                    <span>${type}</span>
                </div>
                <div id="ex-content-${s}-${p}" style="width: 100%; height: 260mm; overflow: hidden;">
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; border-top: 2px solid #1a237e; padding-top: 8px; margin-top: auto; color: #1a237e;">
                    <span>ÉLÈVE : ${student.name.toUpperCase()}</span>
                    <span>PAGE ${p + 1} / ${totalExPages}</span>
                </div>
            `;
            
            const exTarget = exPage.querySelector(`#ex-content-${s}-${p}`);
            if (p === 0 && content) {
                const textDiv = document.createElement('div');
                textDiv.style.width = '100%';
                textDiv.style.fontSize = '12pt';
                textDiv.style.marginBottom = '15px';
                textDiv.innerText = content;
                exTarget.appendChild(textDiv);
            }
            
            if (currentHomeworkImages[p]) {
                const img = document.createElement('img');
                img.src = currentHomeworkImages[p];
                img.style.width = '100%';
                img.style.height = 'auto';
                img.style.maxHeight = (p === 0 && content) ? '200mm' : '255mm';
                img.style.objectFit = 'contain';
                img.style.display = 'block';
                exTarget.appendChild(img);
            }
            
            printContainer.appendChild(exPage);
        }

        // 3. RECTO-VERSO SUPPORT
        if ((1 + totalExPages) % 2 !== 0) {
            const blankPage = document.createElement('div');
            blankPage.className = 'a4-page';
            blankPage.style.background = '#fff';
            printContainer.appendChild(blankPage);
        }
    }

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
// Toutes les données (élèves, devoirs, logo) sont stockées dans
// la table app_state et partagées entre tous les appareils.
// Les élèves de la table centrale `eleves` sont fusionnés ici.
// ═══════════════════════════════════════════════════════════════
(function(){
    const SB_URL = 'https://jircuneixzwsmtktxrkh.supabase.co';
    const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppcmN1bmVpeHp3c210a3R4cmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzI0ODQsImV4cCI6MjA4Nzc0ODQ4NH0.MLAV60tPKhFP8BixVavW3SU-npe8YvS0lKQ493AYNls';
    const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
    const KEYS = ['ideal_students', 'ideal_homeworks', 'ideal_logo'];
    const last = {};

    function parseVal(raw) { try { return JSON.parse(raw); } catch(e) { return raw; } }

    // Push : détecte les changements locaux et les envoie vers Supabase
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

    // Pull initial : état partagé + élèves de la table centrale
    (async () => {
        try {
            const r = await fetch(SB_URL + '/rest/v1/app_state?app=eq.pedago&select=key,value', { headers: H });
            if (r.ok) {
                (await r.json()).forEach(({ key, value }) => {
                    const nv = typeof value === 'string' ? value : JSON.stringify(value);
                    last[key] = nv;
                    localStorage.setItem(key, nv);
                });
            }
            // Fusion des élèves centraux (app React / inscriptions)
            const er = await fetch(SB_URL + '/rest/v1/eleves?actif=eq.true&select=id,prenom,nom,classes(nom)', { headers: H });
            if (er.ok) {
                const ce = await er.json();
                const loc = JSON.parse(localStorage.getItem('ideal_students') || '[]');
                let added = false;
                ce.forEach(e => {
                    const full = ((e.prenom || '') + ' ' + (e.nom || '')).trim();
                    const cn = (e.classes && e.classes.nom) || '';
                    if (full && !loc.some(s => s.sbId === e.id || (s.name || '').toLowerCase() === full.toLowerCase())) {
                        loc.push({ id: Date.now() + Math.floor(Math.random() * 1e6), sbId: e.id, name: full, grade: cn });
                        added = true;
                    }
                });
                if (added) localStorage.setItem('ideal_students', JSON.stringify(loc));
            }
            // Recharger l'état en mémoire et rafraîchir l'interface
            students = JSON.parse(localStorage.getItem('ideal_students')) || [];
            homeworks = JSON.parse(localStorage.getItem('ideal_homeworks')) || [];
            if (typeof renderStudentList === 'function') renderStudentList();
            if (typeof renderArchive === 'function') renderArchive();
            if (typeof updateStats === 'function') updateStats();
            if (typeof loadSavedLogo === 'function') loadSavedLogo();
        } catch(e) { console.warn('Sync Supabase indisponible:', e); }
    })();
})();
