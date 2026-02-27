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

// Clés uniques par utilisateur
const LAST_TS_KEY       = `${userKey}_lastTS`;
const LAST_TENSION_KEY  = `${userKey}_lastTension`;
const LAST_COURANT_KEY  = `${userKey}_lastCourant`;

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

let lastTension = null;
let lastCourant = null;
let tensionChart, courantChart;

let lastTS = null;

// Charger les valeurs sauvegardées pour CET utilisateur
const savedTS = localStorage.getItem(LAST_TS_KEY);
if (savedTS) lastTS = new Date(savedTS);

const savedTension = localStorage.getItem(LAST_TENSION_KEY);
if (savedTension) lastTension = parseFloat(savedTension);

const savedCourant = localStorage.getItem(LAST_COURANT_KEY);
if (savedCourant) lastCourant = parseFloat(savedCourant);

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
        const lastTSFormatted = lastTS ? formatDateTime(lastTS) : "---";

        const response = await fetch("data/" + jsonFile + "?nocache=" + Date.now());
        const data = await response.json();

        const tension = Number(data.tension);
        const courant = Number(data.courant);
        const etat = data.etat;

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
                    <td class="etat ${etat === "Actif" ? "etat-actif" : "etat-inactif"}">${etat}</td>
                </tr>
            </table>
        `;

        document.getElementById('tensionValue').textContent = tension.toFixed(2) + ' V';
        document.getElementById('courantValue').textContent = courant.toFixed(2) + ' A';

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
              lastTS = new Date();
              localStorage.setItem(LAST_TS_KEY, lastTS.toISOString());
        }
        
        if (courant !== lastCourant) {
              courantChart.destroy();
              courantChart = createHalfDonut(courantCtx, courant, 100, '#e67e22', 10);
              lastCourant = courant;
              localStorage.setItem(LAST_COURANT_KEY, courant);
              lastTS = new Date();
              localStorage.setItem(LAST_TS_KEY, lastTS.toISOString());
        }

  } catch (error) {
          console.error('Erreur de chargement des données:', error);
  }
}
updateCharts();
setInterval(updateCharts, 5000);
