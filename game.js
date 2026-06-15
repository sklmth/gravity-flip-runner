// 游戏配置
const CONFIG = {
    playerSize: 30,
    playerSpeed: 5,
    gravity: 0.6,
    jumpForce: 12,
    obstacleWidth: 40,
    obstacleGap: 250,
    coinSize: 20,
    initialSpeed: 4,
    speedIncrease: 0.0035,   // 速度增长加快
    maxSpeed: 14,            // 最高速度提升
    comboTimeout: 2500,      // 连击窗口(毫秒)
    powerupDuration: 6000,   // 道具持续时间(毫秒)
    trailLength: 5,          // 拖尾长度(减弱避免眼花)
    dashSpeed: 16,           // 横冲直撞前冲速度(像素/帧)
    dashMax: 100,            // 横冲能量上限
    dashDrain: 1.6,          // 横冲时每帧能量消耗
    dashRegen: 0.18,         // 平时每帧能量恢复
    dashMashGain: 7          // "使劲按"每次按键补充的能量
};

// 游戏状态
let gameState = {
    score: 0,
    coins: 0,
    highscore: localStorage.getItem('highscore') || 0,
    gameSpeed: CONFIG.initialSpeed,
    isPlaying: false,
    gameOver: false,
    combo: 0,              // 当前连击数
    lastCoinTime: 0,       // 上次吃金币时间
    shield: false,         // 护盾激活
    magnet: false,         // 磁铁激活
    slowmo: false,         // 慢动作激活
    shieldEnd: 0,
    magnetEnd: 0,
    slowmoEnd: 0,
    shake: 0,              // 屏幕震动强度
    dashEnergy: 0,         // 横冲能量
    dashing: false         // 是否正在横冲
};

// Canvas 设置
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 400;

// 玩家对象
const player = {
    x: 100,
    y: canvas.height / 2,
    width: CONFIG.playerSize,
    height: CONFIG.playerSize,
    velocityY: 0,
    gravityDirection: 1, // 1 = 向下, -1 = 向上
    color: '#00ff88',
    trail: []
};

// 障碍物和金币数组
let obstacles = [];
let coins = [];
let particles = [];
let powerups = [];

// 粒子系统
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 4;
        this.speedY = (Math.random() - 0.5) * 4;
        this.color = color;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
        this.size *= 0.97;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 障碍物类
class Obstacle {
    constructor() {
        this.width = CONFIG.obstacleWidth;
        this.height = Math.random() * 100 + 80;
        this.x = canvas.width;
        this.position = Math.random() > 0.5 ? 'top' : 'bottom';
        this.y = this.position === 'top' ? 0 : canvas.height - this.height;
        this.passed = false;
        this.smashed = false;
        this.color = `hsl(${Math.random() * 60 + 300}, 70%, 60%)`;
    }

    update() {
        this.x -= gameState.gameSpeed;
    }

    draw() {
        // 绘制渐变障碍物
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, '#ff006e');

        ctx.fillStyle = gradient;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // 边框
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    collidesWith(player) {
        return player.x < this.x + this.width &&
               player.x + player.width > this.x &&
               player.y < this.y + this.height &&
               player.y + player.height > this.y;
    }
}

// 金币类
class Coin {
    constructor() {
        this.size = CONFIG.coinSize;
        this.x = canvas.width;
        this.y = Math.random() * (canvas.height - 100) + 50;
        this.collected = false;
        this.rotation = 0;
        this.pulseScale = 1;
    }

    update() {
        this.x -= gameState.gameSpeed;
        this.rotation += 0.1;
        this.pulseScale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.pulseScale, this.pulseScale);

        // 外圈光晕
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // 金币主体
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();

        // 金币细节
        ctx.fillStyle = '#ffed4e';
        ctx.beginPath();
        ctx.arc(-5, -5, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    collidesWith(player) {
        const dx = (this.x) - (player.x + player.width / 2);
        const dy = (this.y) - (player.y + player.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.size + player.width / 2;
    }
}

// 道具类型定义
const POWERUP_TYPES = {
    shield: { color: '#00e5ff', emoji: '🛡️', label: '护盾' },
    magnet: { color: '#ff4dd2', emoji: '🧲', label: '磁铁' },
    slowmo: { color: '#a0ff00', emoji: '⏳', label: '慢动作' },
    dash:   { color: '#ffdd00', emoji: '⚡', label: '冲撞能量' }
};

// 道具类
class Powerup {
    constructor() {
        const keys = Object.keys(POWERUP_TYPES);
        this.type = keys[Math.floor(Math.random() * keys.length)];
        this.info = POWERUP_TYPES[this.type];
        this.size = 26;
        this.x = canvas.width;
        this.y = Math.random() * (canvas.height - 120) + 60;
        this.collected = false;
        this.bob = Math.random() * Math.PI * 2;
    }

    update() {
        this.x -= gameState.gameSpeed;
        this.bob += 0.08;
    }

    draw() {
        const oy = Math.sin(this.bob) * 6;
        ctx.save();
        ctx.translate(this.x, this.y + oy);

        // 光晕
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 1.8);
        g.addColorStop(0, this.info.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // 主体
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.info.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();

        // 图标
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.info.emoji, 0, 1);

        ctx.restore();
    }

    collidesWith(player) {
        const dx = this.x - (player.x + player.width / 2);
        const dy = this.y - (player.y + player.height / 2);
        return Math.sqrt(dx * dx + dy * dy) < this.size + player.width / 2;
    }
}

// 创建粒子效果
function createParticles(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// ===== 音效引擎 (Web Audio API, 无需外部音频文件) =====
const SFX = {
    ctx: null,
    masterGain: null,
    volume: 1.6, // 主音量(>1 调大声音)

    init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    // 基础音调
    tone(freq, dur, type = 'square', gain = 0.5, freqEnd = null) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + dur);
    },

    // 噪声爆破(撞击/震动用)
    noise(dur, gain = 0.6, filterFreq = 1200) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, t);
        filter.frequency.exponentialRampToValueAtTime(120, t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);
        src.start(t);
        src.stop(t + dur);
    },

    // —— 具体音效 ——
    flip() { this.tone(420, 0.12, 'triangle', 0.5, 700); },          // 反转重力
    coin() { this.tone(880, 0.07, 'square', 0.5); this.tone(1320, 0.1, 'square', 0.4); }, // 吃金币
    powerup() { this.tone(523, 0.1, 'sawtooth', 0.5); this.tone(784, 0.12, 'sawtooth', 0.5, 1100); }, // 道具
    shieldHit() { this.noise(0.18, 0.9, 2500); this.tone(180, 0.2, 'square', 0.7, 60); }, // 护盾抵挡(重击感)
    crash() { this.noise(0.5, 1.0, 1800); this.tone(140, 0.5, 'sawtooth', 0.9, 40); },    // 撞击死亡(强力打击)
    combo(level) { this.tone(440 + level * 80, 0.1, 'square', 0.5, 660 + level * 100); }, // 连击升级
    dash() { this.tone(300, 0.18, 'sawtooth', 0.6, 900); this.noise(0.12, 0.4, 3000); }   // 横冲直撞
};
function resetGame() {
    player.y = canvas.height / 2;
    player.velocityY = 0;
    player.gravityDirection = 1;
    player.trail = [];

    obstacles = [];
    coins = [];
    particles = [];
    powerups = [];

    gameState.score = 0;
    gameState.coins = 0;
    gameState.gameSpeed = CONFIG.initialSpeed;
    gameState.gameOver = false;
    gameState.isPlaying = true;
    gameState.combo = 0;
    gameState.lastCoinTime = 0;
    gameState.shield = false;
    gameState.magnet = false;
    gameState.slowmo = false;
    gameState.shieldEnd = 0;
    gameState.magnetEnd = 0;
    gameState.slowmoEnd = 0;
    gameState.shake = 0;
    gameState.dashEnergy = 0;
    gameState.dashing = false;

    updateUI();
    document.getElementById('gameOver').classList.remove('active');
    document.body.classList.add('playing'); // 显示手机横冲按钮
}

// 更新UI
function updateUI() {
    document.getElementById('score').textContent = Math.floor(gameState.score);
    document.getElementById('coins').textContent = gameState.coins;
    document.getElementById('highscore').textContent = Math.floor(gameState.highscore);
}

// 反转重力
function flipGravity() {
    if (!gameState.isPlaying || gameState.gameOver) return;
    if (gameState.dashing) return; // 横冲时不响应翻转, 保持直线

    player.gravityDirection *= -1;
    // 跳跃力随速度小幅增强, 保证高速时仍能及时反应
    const speedFactor = gameState.gameSpeed / CONFIG.initialSpeed;
    const jump = CONFIG.jumpForce * (0.9 + speedFactor * 0.12);
    player.velocityY = -jump * player.gravityDirection;

    SFX.flip();

    // 创建反转特效
    createParticles(player.x + player.width / 2, player.y + player.height / 2, player.color, 14);
}

// 横冲直撞: "使劲按"积攒能量并触发, 直线无敌前冲
function dashMash() {
    if (!gameState.isPlaying || gameState.gameOver) return;
    // 每次按键补充能量
    gameState.dashEnergy = Math.min(CONFIG.dashMax, gameState.dashEnergy + CONFIG.dashMashGain);
    // 能量足够即进入横冲状态
    if (!gameState.dashing && gameState.dashEnergy >= CONFIG.dashMax * 0.25) {
        gameState.dashing = true;
        SFX.dash();
        createParticles(player.x, player.y + player.height / 2, '#ffdd00', 16);
    }
}

// 更新玩家
function updatePlayer() {
    // 速度系数: 重力球随游戏速度变化(初速时=1, 满速时约 fast)
    const speedFactor = gameState.gameSpeed / CONFIG.initialSpeed;
    // 慢动作时操控也跟着变慢, 手感一致
    const slow = gameState.slowmo ? 0.6 : 1;

    if (gameState.dashing) {
        // 横冲直撞: 无视重力, 锁定垂直速度, 水平方向象征性前冲(画面表现 + 强拖尾)
        player.velocityY *= 0.6;
        player.y += player.velocityY;
        gameState.dashEnergy -= CONFIG.dashDrain;
        if (gameState.dashEnergy <= 0) {
            gameState.dashEnergy = 0;
            gameState.dashing = false;
        }
    } else {
        // 应用重力(随速度提升而增强, 控制在合理范围)
        const g = CONFIG.gravity * (0.85 + speedFactor * 0.18) * slow;
        player.velocityY += g * player.gravityDirection;
        player.y += player.velocityY * slow;
        // 平时缓慢回充横冲能量
        gameState.dashEnergy = Math.min(CONFIG.dashMax, gameState.dashEnergy + CONFIG.dashRegen);
    }

    // 限制在画布内
    if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;
    }
    if (player.y + player.height > canvas.height) {
        player.y = canvas.height - player.height;
        player.velocityY = 0;
    }

    // 添加轨迹(拖尾减弱: 更短)
    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > CONFIG.trailLength) {
        player.trail.shift();
    }
}

// 绘制玩家
function drawPlayer() {
    const dashing = gameState.dashing;
    // 绘制轨迹(拖尾减弱, 不刺眼; 横冲时略增强表现冲刺感)
    const maxAlpha = dashing ? 0.45 : 0.18;
    player.trail.forEach((point, index) => {
        const t = index / player.trail.length;
        const alpha = t * maxAlpha;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = dashing ? '#ffdd00' : player.color;
        const size = player.width * (0.6 + t * 0.4);
        ctx.fillRect(point.x + (player.width - size) / 2, point.y + (player.height - size) / 2, size, size);
        ctx.restore();
    });

    // 绘制玩家主体
    ctx.save();
    ctx.fillStyle = dashing ? '#ffdd00' : player.color;
    ctx.shadowColor = dashing ? '#ffaa00' : player.color;
    ctx.shadowBlur = dashing ? 25 : 12;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // 绘制眼睛（根据重力方向旋转）
    const eyeY = player.gravityDirection === 1 ? player.y + 10 : player.y + player.height - 10;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(player.x + 10, eyeY, 4, 0, Math.PI * 2);
    ctx.arc(player.x + 20, eyeY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(player.x + 10, eyeY, 2, 0, Math.PI * 2);
    ctx.arc(player.x + 20, eyeY, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 护盾光环 + 剩余时间
    if (gameState.shield) {
        ctx.save();
        const cx = player.x + player.width / 2;
        const cy = player.y + player.height / 2;
        const remainMs = Math.max(0, gameState.shieldEnd - Date.now());
        const remainPct = remainMs / CONFIG.powerupDuration;

        // 外圈光环
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.55 + Math.sin(Date.now() * 0.01) * 0.25;
        ctx.beginPath();
        ctx.arc(cx, cy, player.width, 0, Math.PI * 2);
        ctx.stroke();

        // 剩余时间圆弧(顺时针缩短)
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#aef6ff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, player.width + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remainPct);
        ctx.stroke();

        // 剩余秒数文字
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#aef6ff';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${(remainMs / 1000).toFixed(1)}s`, cx, cy - player.width - 14);
        ctx.restore();
    }
}

// 生成障碍物
function spawnObstacle() {
    if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - CONFIG.obstacleGap) {
        obstacles.push(new Obstacle());
    }
}

// 生成金币
function spawnCoin() {
    if (Math.random() < 0.015 && (coins.length === 0 || coins[coins.length - 1].x < canvas.width - 200)) {
        coins.push(new Coin());
    }
}

// 生成道具
function spawnPowerup() {
    if (Math.random() < 0.0025 && (powerups.length === 0 || powerups[powerups.length - 1].x < canvas.width - 350)) {
        powerups.push(new Powerup());
    }
}

// 激活道具
function activatePowerup(type) {
    const now = Date.now();
    const info = POWERUP_TYPES[type];
    if (type === 'shield') { gameState.shield = true; gameState.shieldEnd = now + CONFIG.powerupDuration; }
    if (type === 'magnet') { gameState.magnet = true; gameState.magnetEnd = now + CONFIG.powerupDuration; }
    if (type === 'slowmo') { gameState.slowmo = true; gameState.slowmoEnd = now + CONFIG.powerupDuration; }
    if (type === 'dash')   { gameState.dashEnergy = CONFIG.dashMax; } // 充满横冲能量
    createParticles(player.x + player.width / 2, player.y + player.height / 2, info.color, 30);
}

// 更新道具计时
function updatePowerupTimers() {
    const now = Date.now();
    if (gameState.shield && now > gameState.shieldEnd) gameState.shield = false;
    if (gameState.magnet && now > gameState.magnetEnd) gameState.magnet = false;
    if (gameState.slowmo && now > gameState.slowmoEnd) gameState.slowmo = false;
}

// 碰撞检测
function checkCollisions() {
    // 检测障碍物碰撞
    for (let obstacle of obstacles) {
        if (obstacle.collidesWith(player)) {
            if (gameState.dashing) {
                // 横冲直撞: 直接击碎障碍物, 无敌穿过
                if (!obstacle.smashed) {
                    obstacle.smashed = true;
                    obstacle.x = -999;
                    gameState.shake = 10;
                    SFX.shieldHit();
                    gameState.score += 5;
                    createParticles(player.x + player.width / 2, player.y + player.height / 2, '#ffdd00', 18);
                }
            } else if (gameState.shield) {
                // 护盾激活期间: 击碎障碍物但不消耗护盾(护盾按时间计)
                if (!obstacle.smashed) {
                    obstacle.smashed = true;
                    obstacle.x = -999;
                    gameState.shake = 12;
                    SFX.shieldHit();
                    createParticles(player.x + player.width / 2, player.y + player.height / 2, '#00e5ff', 24);
                }
            } else {
                endGame();
                return;
            }
        }

        // 计算分数
        if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
            obstacle.passed = true;
            gameState.score += 10;
            createParticles(obstacle.x + obstacle.width, canvas.height / 2, '#00ff88', 10);
        }
    }

    // 检测金币碰撞
    const now = Date.now();
    for (let i = coins.length - 1; i >= 0; i--) {
        if (!coins[i].collected && coins[i].collidesWith(player)) {
            coins[i].collected = true;
            gameState.coins += 1;

            // 连击系统
            if (now - gameState.lastCoinTime < CONFIG.comboTimeout) {
                gameState.combo += 1;
            } else {
                gameState.combo = 1;
            }
            gameState.lastCoinTime = now;

            const multiplier = Math.min(5, 1 + Math.floor(gameState.combo / 3));
            gameState.score += 25 * multiplier;

            // 连击升级时音调更高，否则普通吃币音
            if (gameState.combo >= 2) SFX.combo(Math.min(8, gameState.combo));
            else SFX.coin();

            createParticles(coins[i].x, coins[i].y, '#ffd700', 20);
            coins.splice(i, 1);
        }
    }

    // 连击超时重置
    if (gameState.combo > 0 && now - gameState.lastCoinTime > CONFIG.comboTimeout) {
        gameState.combo = 0;
    }

    // 检测道具碰撞
    for (let i = powerups.length - 1; i >= 0; i--) {
        if (!powerups[i].collected && powerups[i].collidesWith(player)) {
            powerups[i].collected = true;
            SFX.powerup();
            activatePowerup(powerups[i].type);
            powerups.splice(i, 1);
        }
    }
}

// 结束游戏
function endGame() {
    gameState.gameOver = true;
    gameState.isPlaying = false;
    gameState.shake = 22;

    SFX.crash();
    createParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff006e', 40);

    // 更新最高分
    if (gameState.score > gameState.highscore) {
        gameState.highscore = gameState.score;
        localStorage.setItem('highscore', Math.floor(gameState.highscore));
    }

    // 显示游戏结束画面
    document.getElementById('finalScore').textContent = Math.floor(gameState.score);
    document.getElementById('finalCoins').textContent = gameState.coins;
    document.getElementById('finalRank').textContent = '正在上传成绩…';
    document.getElementById('gameOverLbList').innerHTML = '';
    document.getElementById('gameOver').classList.add('active');

    // 隐藏手机横冲按钮
    document.body.classList.remove('playing');

    updateUI();

    // 自动提交成绩并刷新排行榜
    submitAndShowLeaderboard();
}

// 游戏主循环
let uiFrame = 0;
function gameLoop() {
    // 屏幕震动
    ctx.save();
    if (gameState.shake > 0) {
        const dx = (Math.random() - 0.5) * gameState.shake;
        const dy = (Math.random() - 0.5) * gameState.shake;
        ctx.translate(dx, dy);
        gameState.shake *= 0.85;
        if (gameState.shake < 0.5) gameState.shake = 0;
    }

    // 清空画布(略提高不透明度, 让残影更快消散, 画面更干净不眼花)
    ctx.fillStyle = 'rgba(26, 26, 46, 0.32)';
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

    // 绘制星空背景
    if (Math.random() < 0.1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
    }

    if (gameState.isPlaying && !gameState.gameOver) {
        // 更新道具计时
        updatePowerupTimers();

        // 更新游戏速度（慢动作时减速）
        let targetSpeed = Math.min(CONFIG.maxSpeed, CONFIG.initialSpeed + gameState.score * CONFIG.speedIncrease);
        if (gameState.slowmo) targetSpeed *= 0.5;
        gameState.gameSpeed = targetSpeed;

        // 更新分数
        gameState.score += 0.1;

        // 生成障碍物、金币和道具
        spawnObstacle();
        spawnCoin();
        spawnPowerup();

        // 磁铁效果：吸引附近金币
        if (gameState.magnet) {
            const px = player.x + player.width / 2;
            const py = player.y + player.height / 2;
            for (let c of coins) {
                const dx = px - c.x;
                const dy = py - c.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 220) {
                    c.x += dx * 0.12;
                    c.y += dy * 0.12;
                }
            }
        }

        // 更新玩家
        updatePlayer();

        // 更新和绘制障碍物
        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].update();
            obstacles[i].draw();

            if (obstacles[i].x + obstacles[i].width < 0) {
                obstacles.splice(i, 1);
            }
        }

        // 更新和绘制金币
        for (let i = coins.length - 1; i >= 0; i--) {
            coins[i].update();
            coins[i].draw();

            if (coins[i].x + coins[i].size < 0) {
                coins.splice(i, 1);
            }
        }

        // 更新和绘制道具
        for (let i = powerups.length - 1; i >= 0; i--) {
            powerups[i].update();
            powerups[i].draw();

            if (powerups[i].x + powerups[i].size < 0) {
                powerups.splice(i, 1);
            }
        }

        // 检测碰撞
        checkCollisions();

        // 更新UI(每6帧一次, 稳定且不抖动)
        uiFrame++;
        if (uiFrame % 6 === 0) {
            updateUI();
        }
    }

    // 更新和绘制粒子
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();

        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }

    // 绘制玩家
    drawPlayer();

    // 绘制HUD（速度、连击、道具状态）
    if (gameState.isPlaying && !gameState.gameOver) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`速度: ${gameState.gameSpeed.toFixed(1)}x`, 10, 20);

        // 连击显示
        if (gameState.combo >= 2) {
            const mult = Math.min(5, 1 + Math.floor(gameState.combo / 3));
            ctx.save();
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = `hsl(${(Date.now() * 0.2) % 360}, 90%, 60%)`;
            ctx.textAlign = 'center';
            ctx.fillText(`连击 x${gameState.combo}  (得分 x${mult})`, canvas.width / 2, 35);
            ctx.restore();
        }

        // 道具状态条
        drawPowerupStatus();

        // 横冲能量条(底部)
        drawDashMeter();
    }

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

// 绘制横冲能量条
function drawDashMeter() {
    const pct = gameState.dashEnergy / CONFIG.dashMax;
    const w = 180, h = 12;
    const x = canvas.width - w - 12;
    const y = canvas.height - h - 12;
    const ready = gameState.dashEnergy >= CONFIG.dashMax * 0.25;

    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = gameState.dashing ? '#ffdd00' : (ready ? '#ffe680' : 'rgba(255,255,255,0.5)');
    ctx.fillText(gameState.dashing ? '⚡ 横冲中!' : '⚡ 横冲(连按 Shift)', x - 8, y + h / 2);

    // 底槽
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, w, h);
    // 能量
    ctx.fillStyle = gameState.dashing ? '#fff' : '#ffdd00';
    ctx.fillRect(x, y, w * pct, h);
    // 可触发阈值刻度
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x + w * 0.25 - 1, y - 2, 2, h + 4);
    // 边框
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
}

// 绘制道具状态
function drawPowerupStatus() {
    const now = Date.now();
    const active = [];
    if (gameState.shield) active.push({ info: POWERUP_TYPES.shield, end: gameState.shieldEnd });
    if (gameState.magnet) active.push({ info: POWERUP_TYPES.magnet, end: gameState.magnetEnd });
    if (gameState.slowmo) active.push({ info: POWERUP_TYPES.slowmo, end: gameState.slowmoEnd });

    let y = 40;
    for (const a of active) {
        const remain = Math.max(0, (a.end - now) / CONFIG.powerupDuration);
        ctx.save();
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillStyle = a.info.color;
        ctx.fillText(`${a.info.emoji} ${a.info.label}`, 10, y);
        // 进度条
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(95, y - 12, 80, 8);
        ctx.fillStyle = a.info.color;
        ctx.fillRect(95, y - 12, 80 * remain, 8);
        ctx.restore();
        y += 24;
    }
}

// ===== 设备检测 =====
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ===== 玩家与排行榜 =====
const API = {
    async submit(name, score, coins) {
        const res = await fetch('/api/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score, coins })
        });
        if (!res.ok) throw new Error('submit failed');
        return res.json();
    },
    async leaderboard(limit = 10) {
        const res = await fetch(`/api/leaderboard?limit=${limit}`);
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
    }
};

let playerName = localStorage.getItem('playerName') || '';

const MEDALS = ['🥇', '🥈', '🥉'];

// 渲染榜单到指定 <ol>
function renderLeaderboard(listEl, rows, emptyEl) {
    listEl.innerHTML = '';
    if (!rows || rows.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    rows.forEach((r) => {
        const li = document.createElement('li');
        const medal = r.rank <= 3 ? MEDALS[r.rank - 1] : `<span class="lb-rank">${r.rank}</span>`;
        const isMe = r.name === playerName;
        li.className = 'lb-row' + (isMe ? ' lb-me' : '');
        li.innerHTML = `
            <span class="lb-medal">${medal}</span>
            <span class="lb-name">${escapeHtml(r.name)}</span>
            <span class="lb-score">${r.score}</span>
            <span class="lb-coins">💎${r.coins}</span>`;
        listEl.appendChild(li);
    });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// 提交本局成绩并刷新结束页榜单
async function submitAndShowLeaderboard() {
    const finalRankEl = document.getElementById('finalRank');
    const listEl = document.getElementById('gameOverLbList');
    const score = Math.floor(gameState.score);
    const coins = gameState.coins;

    try {
        const result = await API.submit(playerName, score, coins);
        finalRankEl.textContent = `🏅 你的排名：第 ${result.rank} 名 / 共 ${result.total} 人`;
        const lb = await API.leaderboard(10);
        renderLeaderboard(listEl, lb.list);
    } catch (e) {
        finalRankEl.textContent = '⚠️ 排行榜暂时无法连接（成绩未上传）';
        listEl.innerHTML = '';
    }
}

// 打开独立排行榜
async function openLeaderboard() {
    const listEl = document.getElementById('fullLbList');
    const emptyEl = document.getElementById('lbEmpty');
    listEl.innerHTML = '<li class="lb-loading">加载中…</li>';
    emptyEl.style.display = 'none';
    document.getElementById('startScreen').classList.remove('active');
    document.getElementById('leaderboardScreen').classList.add('active');
    try {
        const lb = await API.leaderboard(20);
        renderLeaderboard(listEl, lb.list, emptyEl);
    } catch (e) {
        listEl.innerHTML = '';
        emptyEl.textContent = '⚠️ 排行榜暂时无法连接';
        emptyEl.style.display = 'block';
    }
}

// ===== 界面流转 =====
function showLogin() {
    document.getElementById('startScreen').classList.remove('active');
    document.getElementById('leaderboardScreen').classList.remove('active');
    document.getElementById('loginScreen').classList.add('active');
    const input = document.getElementById('nameInput');
    input.value = playerName;
    setTimeout(() => input.focus(), 50);
}

function enterStartScreen() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('leaderboardScreen').classList.remove('active');
    document.getElementById('startScreen').classList.add('active');
    document.getElementById('greetName').textContent = playerName;
    document.getElementById('playerNameTag').textContent = playerName;
}

function doLogin() {
    const input = document.getElementById('nameInput');
    const errEl = document.getElementById('loginError');
    const name = input.value.trim().slice(0, 12);
    if (!name) {
        errEl.textContent = '请输入名字哦~';
        input.focus();
        return;
    }
    playerName = name;
    localStorage.setItem('playerName', playerName);
    errEl.textContent = '';
    enterStartScreen();
}

// 按设备注入操作说明
function injectInstructions() {
    const el = document.getElementById('instructions');
    if (isTouch) {
        el.innerHTML = `
            <p>🎮 <strong>触屏操作</strong></p>
            <p>👆 点击屏幕 反转重力</p>
            <p>⚡ 连点右下角 <strong>横冲</strong> 按钮，无视碰撞直线穿越！</p>
            <p>💎 连续吃金币触发<strong>连击</strong>，得分翻倍(最高 x5)</p>
            <p>🛡️ 护盾(有倒计时)　🧲 磁铁　⏳ 慢动作　⚡ 充能</p>
            <p>🚀 速度快速攀升，重力也随之变强！</p>`;
        document.getElementById('controlsHint').innerHTML = '<p>点击屏幕 反转重力　·　连点 ⚡ 横冲</p>';
    } else {
        el.innerHTML = `
            <p>🎮 <strong>操作方式</strong></p>
            <p>点击屏幕或按 <kbd>空格键</kbd> 反转重力</p>
            <p>⚡ 连按 <kbd>Shift</kbd>(或右键)<strong>横冲直撞</strong>，无视碰撞直线穿越！</p>
            <p>💎 连续吃金币触发<strong>连击</strong>，得分翻倍(最高 x5)</p>
            <p>🛡️ 护盾(有倒计时)　🧲 磁铁　⏳ 慢动作　⚡ 充能</p>
            <p>⚠️ 避开障碍物　🔇 按 <kbd>M</kbd> 静音</p>
            <p>🚀 速度快速攀升，重力也随之变强！</p>`;
    }
}

// ===== 事件监听 =====
// 首次用户交互时初始化/恢复音频(浏览器自动播放策略要求)
function unlockAudio() {
    SFX.init();
    SFX.resume();
}
window.addEventListener('pointerdown', unlockAudio, { once: false });
window.addEventListener('keydown', unlockAudio, { once: false });

// —— 反转重力: 点击 / 触摸 ——
canvas.addEventListener('click', flipGravity);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();        // 防止触屏点击的 300ms 延迟与页面滚动/缩放
    unlockAudio();
    flipGravity();
}, { passive: false });

// —— 横冲: 右键(电脑) ——
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    dashMash();
});

// —— 横冲按钮(手机) ——
const dashBtn = document.getElementById('dashBtn');
dashBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    unlockAudio();
    dashMash();
}, { passive: false });
dashBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dashMash();
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        flipGravity();
    }
    // Shift 连按触发横冲直撞(允许自动重复, 按住也能持续冲)
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        dashMash();
    }
    // 按 M 静音/恢复
    if (e.code === 'KeyM') {
        SFX.init();
        SFX.muted = !SFX.muted;
        if (SFX.masterGain) SFX.masterGain.gain.value = SFX.muted ? 0 : SFX.volume;
    }
});

// 登录
document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('nameInput').addEventListener('keydown', (e) => {
    if (e.code === 'Enter') doLogin();
});

// 开始 / 重开 / 换名字 / 排行榜
document.getElementById('startBtn').addEventListener('click', () => {
    unlockAudio();
    document.getElementById('startScreen').classList.remove('active');
    resetGame();
});

document.getElementById('restartBtn').addEventListener('click', () => {
    unlockAudio();
    resetGame();
});

document.getElementById('changeNameBtn').addEventListener('click', showLogin);
document.getElementById('showLbBtn').addEventListener('click', openLeaderboard);
document.getElementById('lbBackBtn').addEventListener('click', enterStartScreen);

// ===== 初始化 =====
if (isTouch) document.body.classList.add('touch');
injectInstructions();
updateUI();
if (playerName) {
    enterStartScreen();           // 已登录, 直接进开始页
} else {
    showLogin();                  // 未登录, 先输入姓名
}
gameLoop();

