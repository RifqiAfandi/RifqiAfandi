const https = require('https');

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

// Generate progress bar (HTML)
function generateProgressBar(languages, totalBytes) {
  let bar = '';
  for (const [lang, bytes] of languages) {
    const percentage = (bytes / totalBytes) * 100;
    const color = LANG_COLORS[lang] || '#8b949e';
    bar += `<span style="background-color: ${color}; width: ${percentage.toFixed(2)}%; height: 8px; display: inline-block;"></span>`;
  }
  return bar;
}

// Generate README content
function generateReadme(langData, contributions, streaks, createdAt) {
  const totalBytes = Object.values(langData).reduce((a, b) => a + b, 0);
  const sortedLangs = Object.entries(langData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  
  const calendar = contributions.contributionsCollection.contributionCalendar;
  const totalContributions = calendar.totalContributions;
  
  // Language emoji colors
  const langEmoji = {
    'JavaScript': '🟡',
    'Python': '🔵',
    'HTML': '🔴',
    'CSS': '🟣',
    'TypeScript': '🔵',
    'Java': '🟠',
    'PHP': '🟣',
    'Dockerfile': '⚫',
    'Shell': '🟢',
    'C++': '🔴',
    'C': '⚫',
    'Ruby': '🔴',
    'Go': '🔵',
    'Rust': '🟠',
    'Kotlin': '🟣',
    'Swift': '🟠',
    'Dart': '🔵'
  };
  
  // Build progress bar using unicode blocks
  const barWidth = 50;
  let progressBar = '';
  for (const [lang, bytes] of sortedLangs) {
    const pct = bytes / totalBytes;
    const blocks = Math.max(Math.round(pct * barWidth), 1);
    progressBar += '█'.repeat(blocks);
  }
  // Fill remaining with empty blocks
  const remaining = barWidth - progressBar.length;
  if (remaining > 0) {
    progressBar += '░'.repeat(remaining);
  }
  
  // Build language rows (2 columns)
  const langRows = [];
  for (let i = 0; i < sortedLangs.length; i += 2) {
    const [lang1, bytes1] = sortedLangs[i];
    const pct1 = ((bytes1 / totalBytes) * 100).toFixed(2);
    const emoji1 = langEmoji[lang1] || '⚪';
    
    let col2 = '';
    if (sortedLangs[i + 1]) {
      const [lang2, bytes2] = sortedLangs[i + 1];
      const pct2 = ((bytes2 / totalBytes) * 100).toFixed(2);
      const emoji2 = langEmoji[lang2] || '⚪';
      col2 = `${emoji2} ${lang2} \`${pct2}%\``;
    }
    
    langRows.push(`| ${emoji1} ${lang1} \`${pct1}%\` | ${col2} |`);
  }

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
<div align="center">

<table>
<tr><td>

<div align="center">

| <h1>${totalContributions}</h1><br><sub>Total Contributions</sub><br><sup>${formatDateFull(createdAt)} - Present</sup> | <h1>🔥 ${streaks.current.count}</h1><br><sub><b>Current Streak</b></sub><br><sup>${formatDate(streaks.current.start)} - ${formatDate(streaks.current.end)}</sup> | <h1>${streaks.longest.count}</h1><br><sub>Longest Streak</sub><br><sup>${formatDate(streaks.longest.start)} - ${formatDate(streaks.longest.end)}</sup> |
|:---:|:---:|:---:|

</div>

</td></tr>
</table>

<table>
<tr><td>

<h4>Most Used Languages</h4>

\`\`\`text
${progressBar}
\`\`\`

${langRows.join('\n')}
|:---|:---|

</td></tr>
</table>

</div>

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
  
  console.log('Calculating streaks...');
  const streaks = calculateStreaks(calendar.weeks);
  console.log(`Current streak: ${streaks.current.count}, Longest: ${streaks.longest.count}`);
  
  console.log('Generating README...');
  const readme = generateReadme(langData, contributions, streaks, contributions.createdAt);
  
  const fs = require('fs');
  fs.writeFileSync('README.md', readme);
  
  console.log('README.md generated successfully!');
}

main().catch(console.error);
