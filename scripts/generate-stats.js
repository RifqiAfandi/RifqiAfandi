const https = require('https');
const fs = require('fs');

const USERNAME = 'RifqiAfandi';

// Language colors
const LANG_COLORS = {
  'JavaScript': '#f1e05a',
  'Python': '#3572A5',
  'HTML': '#e34c26',
  'CSS': '#563d7c',
  'TypeScript': '#3178c6',
  'Java': '#b07219',
  'PHP': '#4F5D95',
  'Dockerfile': '#384d54',
  'Shell': '#89e051',
  'C++': '#f34b7d',
  'C': '#555555',
  'Ruby': '#701516',
  'Go': '#00ADD8',
  'Rust': '#dea584',
  'Kotlin': '#A97BFF',
  'Swift': '#F05138',
  'Dart': '#00B4AB'
};

// Fetch helper
function fetchJSON(url, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'GitHub-Stats-Generator',
        'Accept': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// GraphQL fetch
function fetchGraphQL(query, token) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    
    const options = {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'User-Agent': 'GitHub-Stats-Generator',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Get all repos
async function getRepos(token) {
  const repos = [];
  let page = 1;
  
  while (true) {
    const url = `https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}`;
    const data = await fetchJSON(url, token);
    
    if (data.length === 0) break;
    repos.push(...data.filter(r => !r.fork));
    page++;
  }
  
  return repos;
}

// Get languages for each repo (bytes)
async function getLanguages(repos, token) {
  const langBytes = {};
  
  for (const repo of repos) {
    try {
      const url = `https://api.github.com/repos/${USERNAME}/${repo.name}/languages`;
      const langs = await fetchJSON(url, token);
      
      for (const [lang, bytes] of Object.entries(langs)) {
        langBytes[lang] = (langBytes[lang] || 0) + bytes;
      }
    } catch (e) {
      console.error(`Error fetching languages for ${repo.name}:`, e.message);
    }
  }
  
  return langBytes;
}

// Get contribution data
async function getContributions(token) {
  const query = `
    query {
      user(login: "${USERNAME}") {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
        createdAt
      }
    }
  `;
  
  const result = await fetchGraphQL(query, token);
  return result.data.user;
}

// Calculate streaks
function calculateStreaks(weeks) {
  const allDays = weeks.flatMap(w => w.contributionDays);
  
  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  
  // Current streak (from today backwards)
  let currentStreak = 0;
  let currentStart = '';
  let currentEnd = '';
  
  // Reverse to start from most recent
  const reversedDays = [...allDays].reverse();
  
  // Skip future days
  let startIndex = reversedDays.findIndex(d => d.date <= today);
  if (startIndex === -1) startIndex = 0;
  
  for (let i = startIndex; i < reversedDays.length; i++) {
    const day = reversedDays[i];
    if (day.contributionCount > 0) {
      if (currentStreak === 0) currentEnd = day.date;
      currentStreak++;
      currentStart = day.date;
    } else if (currentStreak > 0) {
      break;
    }
  }
  
  // Longest streak
  let longestStreak = 0;
  let longestStart = '';
  let longestEnd = '';
  let tempStreak = 0;
  let tempStart = '';
  
  for (const day of allDays) {
    if (day.contributionCount > 0) {
      if (tempStreak === 0) tempStart = day.date;
      tempStreak++;
      
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
        longestStart = tempStart;
        longestEnd = day.date;
      }
    } else {
      tempStreak = 0;
    }
  }
  
  return {
    current: { count: currentStreak, start: currentStart, end: currentEnd },
    longest: { count: longestStreak, start: longestStart, end: longestEnd }
  };
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function formatDateFull(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Generate Streak SVG (compact for side-by-side)
function generateStreakSVG(totalContributions, streaks, createdAt) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180" viewBox="0 0 400 180">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d1117"/>
      <stop offset="100%" style="stop-color:#161b22"/>
    </linearGradient>
    <linearGradient id="fireGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ff9a00"/>
      <stop offset="100%" style="stop-color:#ff6b00"/>
    </linearGradient>
  </defs>
  
  <rect width="400" height="180" rx="12" fill="url(#bgGrad)" stroke="#30363d" stroke-width="1"/>
  
  <!-- Header -->
  <text x="200" y="25" fill="#58a6ff" font-family="Segoe UI, Ubuntu, sans-serif" font-size="14" font-weight="600" text-anchor="middle">🔥 Contribution Streak</text>
  <line x1="30" y1="38" x2="370" y2="38" stroke="#21262d" stroke-width="1"/>
  
  <!-- Stats Grid -->
  <g transform="translate(67, 85)">
    <text x="0" y="0" fill="#8b949e" font-family="Segoe UI, Ubuntu, sans-serif" font-size="11" text-anchor="middle">Total</text>
    <text x="0" y="28" fill="#e6edf3" font-family="Segoe UI, Ubuntu, sans-serif" font-size="26" font-weight="700" text-anchor="middle">${totalContributions}</text>
    <text x="0" y="48" fill="#484f58" font-family="Segoe UI, Ubuntu, sans-serif" font-size="9" text-anchor="middle">${formatDateFull(createdAt)}</text>
  </g>
  
  <line x1="133" y1="55" x2="133" y2="140" stroke="#21262d" stroke-width="1"/>
  
  <g transform="translate(200, 85)">
    <text x="0" y="-25" fill="#ff9a00" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16" text-anchor="middle">🔥</text>
    <text x="0" y="0" fill="#ff9a00" font-family="Segoe UI, Ubuntu, sans-serif" font-size="11" font-weight="600" text-anchor="middle">Current</text>
    <text x="0" y="32" fill="#ff9a00" font-family="Segoe UI, Ubuntu, sans-serif" font-size="32" font-weight="700" text-anchor="middle">${streaks.current.count}</text>
    <text x="0" y="52" fill="#484f58" font-family="Segoe UI, Ubuntu, sans-serif" font-size="9" text-anchor="middle">${formatDate(streaks.current.start)} - ${formatDate(streaks.current.end)}</text>
  </g>
  
  <line x1="267" y1="55" x2="267" y2="140" stroke="#21262d" stroke-width="1"/>
  
  <g transform="translate(333, 85)">
    <text x="0" y="0" fill="#8b949e" font-family="Segoe UI, Ubuntu, sans-serif" font-size="11" text-anchor="middle">Longest</text>
    <text x="0" y="28" fill="#e6edf3" font-family="Segoe UI, Ubuntu, sans-serif" font-size="26" font-weight="700" text-anchor="middle">${streaks.longest.count}</text>
    <text x="0" y="48" fill="#484f58" font-family="Segoe UI, Ubuntu, sans-serif" font-size="9" text-anchor="middle">${formatDate(streaks.longest.start)} - ${formatDate(streaks.longest.end)}</text>
  </g>
  
  <!-- Footer -->
  <rect x="20" y="150" width="360" height="22" rx="6" fill="#21262d"/>
  <text x="200" y="165" fill="#7d8590" font-family="Segoe UI, Ubuntu, sans-serif" font-size="10" text-anchor="middle">Keep coding! Every commit counts 🚀</text>
</svg>`;
}

// Generate Languages SVG (compact for side-by-side)
function generateLanguagesSVG(langData) {
  const totalBytes = Object.values(langData).reduce((a, b) => a + b, 0);
  const sortedLangs = Object.entries(langData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  
  // Progress bar
  let progressBarSVG = '';
  let xOffset = 20;
  const barWidth = 360;
  
  for (const [lang, bytes] of sortedLangs) {
    const percentage = bytes / totalBytes;
    const segmentWidth = Math.max(percentage * barWidth, 2);
    const color = LANG_COLORS[lang] || '#8b949e';
    progressBarSVG += `<rect x="${xOffset}" y="45" width="${segmentWidth}" height="8" fill="${color}"/>`;
    xOffset += segmentWidth;
  }
  
  // Language items (2 columns, 3 rows)
  let langItemsSVG = '';
  
  for (let i = 0; i < sortedLangs.length; i++) {
    const [lang, bytes] = sortedLangs[i];
    const percentage = ((bytes / totalBytes) * 100).toFixed(1);
    const color = LANG_COLORS[lang] || '#8b949e';
    
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? 30 : 210;
    const y = 80 + (row * 28);
    
    langItemsSVG += `
    <g transform="translate(${x}, ${y})">
      <circle cx="5" cy="5" r="5" fill="${color}"/>
      <text x="16" y="9" fill="#e6edf3" font-family="Segoe UI, Ubuntu, sans-serif" font-size="11" font-weight="500">${lang}</text>
      <text x="165" y="9" fill="#7d8590" font-family="Segoe UI, Ubuntu, sans-serif" font-size="11" text-anchor="end">${percentage}%</text>
    </g>`;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180" viewBox="0 0 400 180">
  <defs>
    <linearGradient id="bgGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d1117"/>
      <stop offset="100%" style="stop-color:#161b22"/>
    </linearGradient>
  </defs>
  
  <rect width="400" height="180" rx="12" fill="url(#bgGrad2)" stroke="#30363d" stroke-width="1"/>
  
  <!-- Header -->
  <text x="200" y="25" fill="#58a6ff" font-family="Segoe UI, Ubuntu, sans-serif" font-size="14" font-weight="600" text-anchor="middle">📊 Most Used Languages</text>
  <line x1="30" y1="38" x2="370" y2="38" stroke="#21262d" stroke-width="1"/>
  
  <!-- Progress Bar Background -->
  <rect x="20" y="45" width="360" height="8" rx="4" fill="#21262d"/>
  
  <!-- Progress Bar Segments -->
  ${progressBarSVG}
  
  <!-- Round corners for first and last -->
  <rect x="20" y="45" width="8" height="8" rx="4" fill="${LANG_COLORS[sortedLangs[0]?.[0]] || '#8b949e'}"/>
  
  <!-- Language Items -->
  ${langItemsSVG}
</svg>`;
}

// Generate README content
function generateReadme(langData, contributions, streaks, createdAt) {
  const readme = `<h1 align="center">Hey 👋What's Up?</h1>

###

<br clear="both">

<div align="center">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bootstrap/bootstrap-original.svg" height="25" alt="bootstrap logo"  />
  <img width="12" />
  <img src="https://skillicons.dev/icons?i=tailwind" height="25" alt="tailwindcss logo"  />
  <img width="12" />
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" height="25" alt="javascript logo"  />
  <img width="12" />
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg" height="25" alt="html5 logo"  />
  <img width="12" />
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" height="25" alt="nodejs logo"  />
  <img width="12" />
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" height="25" alt="python logo"  />
  <img width="12" />
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" height="25" alt="react logo"  />
  <img width="12" />
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/sequelize/sequelize-original.svg" height="25" alt="sequelize logo"  />
  <img width="12" />
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/oracle/oracle-original.svg" height="25" alt="oracle logo"  />
  <img width="12" />
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg" height="25" alt="vscode logo"  />
</div>

###

<div align="center">
  <a href="https://www.linkedin.com/in/rifqi-afandi-unej/" target="_blank">
    <img src="https://raw.githubusercontent.com/maurodesouza/profile-readme-generator/master/src/assets/icons/social/linkedin/default.svg" width="37" height="25" alt="linkedin logo"  />
  </a>
  <a href="https://www.instagram.com/ryf.afn/" target="_blank">
    <img src="https://raw.githubusercontent.com/maurodesouza/profile-readme-generator/master/src/assets/icons/social/instagram/default.svg" width="37" height="25" alt="instagram logo"  />
  </a>
  <a href="https://wa.me/085230259230" target="_blank">
    <img src="https://raw.githubusercontent.com/maurodesouza/profile-readme-generator/master/src/assets/icons/social/whatsapp/default.svg" width="37" height="25" alt="whatsapp logo"  />
  </a>
  <a href="https://mail.google.com/mail/u/0/?fs=1&to=rifqitriafandi.20@gmail.com" target="_blank">
    <img src="https://raw.githubusercontent.com/maurodesouza/profile-readme-generator/master/src/assets/icons/social/gmail/default.svg" width="37" height="25" alt="gmail logo"  />
  </a>
</div>

###

<!-- GitHub Stats - Auto Generated -->
<p align="center">
  <img src="./assets/streak-stats.svg" alt="Streak Stats" />
  <img src="./assets/languages.svg" alt="Most Used Languages" />
</p>

###

<div align="center">
  <img src="https://visitor-badge.laobi.icu/badge?page_id=RifqiAfandi.RifqiAfandi&left_color=orange&right_color=yellow"  />
</div>

###

<!-- Last updated: ${new Date().toISOString()} -->
`;

  return readme;
}

// Main
async function main() {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    console.error('GITHUB_TOKEN is required');
    process.exit(1);
  }
  
  console.log('Fetching repositories...');
  const repos = await getRepos(token);
  console.log(`Found ${repos.length} repositories`);
  
  console.log('Fetching languages...');
  const langData = await getLanguages(repos, token);
  console.log('Languages:', Object.keys(langData));
  
  console.log('Fetching contributions...');
  const contributions = await getContributions(token);
  const calendar = contributions.contributionsCollection.contributionCalendar;
  const totalContributions = calendar.totalContributions;
  
  console.log('Calculating streaks...');
  const streaks = calculateStreaks(calendar.weeks);
  console.log(`Current streak: ${streaks.current.count}, Longest: ${streaks.longest.count}`);
  
  // Create assets directory
  if (!fs.existsSync('assets')) {
    fs.mkdirSync('assets', { recursive: true });
  }
  
  console.log('Generating SVG files...');
  
  // Generate and save Streak SVG
  const streakSVG = generateStreakSVG(totalContributions, streaks, contributions.createdAt);
  fs.writeFileSync('assets/streak-stats.svg', streakSVG);
  console.log('Generated: assets/streak-stats.svg');
  
  // Generate and save Languages SVG
  const languagesSVG = generateLanguagesSVG(langData);
  fs.writeFileSync('assets/languages.svg', languagesSVG);
  console.log('Generated: assets/languages.svg');
  
  console.log('Generating README...');
  const readme = generateReadme(langData, contributions, streaks, contributions.createdAt);
  fs.writeFileSync('README.md', readme);
  
  console.log('All files generated successfully!');
}

main().catch(console.error);
