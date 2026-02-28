// Normalise un nom : enlève les accents et met en minuscules
function normalizeName(str) {
    return str
        .normalize("NFD")                 // sépare les accents
        .replace(/[\u0300-\u036f]/g, "")  // retire les accents
        .replace(/\s+/g, "_")             // remplace espaces par _
        .toLowerCase();                   // met en minuscules
}

// Récupère le nom affiché (avec accents)
const userName = window.USER_NAME || "Utilisateur";

// Récupère une version normalisée pour les clés du localStorage
const userKey = normalizeName(userName);

// Clés uniques par utilisateur (pour éviter de redessiner inutilement)
const LAST_TENSION_KEY  = `${userKey}_lastTension`;
const LAST_COURANT_KEY  = `${userKey}_lastCourant`;
const TIMEOUT_KEY = `${userKey}_timeout`;

// Fichier JSON à charger
const jsonFile = window.JSON_FILE || "data.json";

const tensionCtx = document.getElementById('tensionChart').getContext('2d');
const courantCtx = document.getElementById('courantChart').getContext('2d');

// Plugin pour graduation
const graduationPlugin = {
    id: 'graduationTicks',
    afterDraw(chart) {
        const { ctx, chartArea } = chart;

        const meta = chart._metasets && chart._metasets[0];
        const firstData = meta && meta.data && meta.data[0];
        if (!firstData) return;

        const centerX = chartArea.left + chartArea.width / 2;
        const centerY = chartArea.top + chartArea.height / 2 + firstData.outerRadius / 2;
        const radius = firstData.outerRadius;
        const segments = chart.config.options.plugins.graduationSegments || 15;

        ctx.save();
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;

        for (let i = 0; i <= segments; i++) {
            const angle = (-180 + (180 * i / segments)) * Math.PI / 180;
            const x1 = centerX + Math.cos(angle) * (radius - 8);
            const y1 = centerY + Math.sin(angle) * (radius - 8);
            const x2 = centerX + Math.cos(angle) * radius;
            const y2 = centerY + Math.sin(angle) * radius;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        ctx.restore();
    }
};

let lastTension = parseFloat(localStorage.getItem(LAST_TENSION_KEY)) || null;
let lastCourant = parseFloat(localStorage.getItem(LAST_COURANT_KEY)) || null;

let tensionChart = null;
let courantChart = null;

function createHalfDonut(ctx, value, max, color, segments) {
    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [value, max - value],
                backgroundColor: [color, '#eee'],
                borderWidth: 0
            }]
        },
        options: {
            rotation: -90,
            circumference: 180,
            cutout: '70%',
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
                graduationSegments: segments
            }
        },
        plugins: [graduationPlugin]
    });
}

function formatDateTime(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} - ${hh}:${min}:${ss}`;
}

async function updateCharts() {
    try {
        const now = new Date();
        const nowFormatted = formatDateTime(now);

        // Charger JSON
        const response = await fetch("data/" + jsonFile + "?nocache=" + Date.now());
        const data = await response.json();

        const tension = Number(data.tension);
        const courant = Number(data.courant);
        const etatJSON = data.etat;

        // NOUVEAU : timestamp provenant du JSON
        const lastTS = data.timestamp ? new Date(data.timestamp) : null;
        const lastTSFormatted = lastTS ? formatDateTime(lastTS) : "---";

        // Lire le délai choisi dans la dropdown (en minutes)
        const timeoutMinutes = parseInt(document.getElementById("timeoutSelect").value, 10);
        
        // Calculer le temps écoulé depuis la dernière mise à jour
        let etatFinal = etatJSON; // valeur provenant du JSON
        
        if (lastTS) {
            const diffMinutes = (now - lastTS) / 1000 / 60;
            if (diffMinutes > timeoutMinutes) {
                etatFinal = "Inactif";
            }
        }
        
        // Mise à jour de l'affichage
        document.getElementById('timestamp').innerHTML = `
            <table class="info-table">
                <tr>
                    <td><strong>Board</strong></td>
                    <td>${userName}</td>
                </tr>
                <tr>
                    <td><strong>Dernière vérification</strong></td>
                    <td>${nowFormatted}</td>
                </tr>
                <tr>
                    <td><strong>Dernière mise à jour</strong></td>
                    <td>${lastTSFormatted}</td>
                </tr>
                <tr>
                    <td><strong>État du board</strong></td>
                    <td class="etat ${etatFinal === "Actif" ? "etat-actif" : "etat-inactif"}">${etatFinal}</td>
                </tr>
            </table>
        `;

        document.getElementById('tensionValue').textContent = tension.toFixed(2) + ' V';
        document.getElementById('courantValue').textContent = courant.toFixed(2) + ' A';

        // Création initiale des graphiques
        if (!tensionChart) {
            tensionChart = createHalfDonut(tensionCtx, tension, 15, '#3498db', 15);
        }

        if (!courantChart) {
            courantChart = createHalfDonut(courantCtx, courant, 100, '#e67e22', 10);
        }

        // Mise à jour si changement
        if (tension !== lastTension) {
            tensionChart.destroy();
            tensionChart = createHalfDonut(tensionCtx, tension, 15, '#3498db', 15);
            lastTension = tension;
            localStorage.setItem(LAST_TENSION_KEY, tension);
        }

        if (courant !== lastCourant) {
            courantChart.destroy();
            courantChart = createHalfDonut(courantCtx, courant, 100, '#e67e22', 10);
            lastCourant = courant;
            localStorage.setItem(LAST_COURANT_KEY, courant);
        }

    } catch (error) {
        console.error('Erreur de chargement des données:', error);
    }
}

updateCharts();
setInterval(updateCharts, 5000);
