const originalConsoleError = console.error;
console.error = function (...args) {
    const errorString = args.join(' ');
    if (
        errorString.includes('PartialReadError') ||
        errorString.includes('VarInt') ||
        errorString.includes('SlotComponent') ||
        errorString.includes('Read error for undefined') ||
        errorString.includes('Unexpected buffer end') ||
        errorString.includes('entityMetadata') ||
        errorString.includes('packet_entity_metadata') ||
        errorString.includes('ERR_OUT_OF_RANGE') ||
        errorString.includes('protodef')
    ) {
        return;
    }
    originalConsoleError.apply(console, args);
};

process.on('uncaughtException', function (err) {
    if (
        err.name === 'PartialReadError' ||
        err.message.includes('VarInt') ||
        err.message.includes('Read error for undefined') ||
        err.message.includes('Unexpected buffer end') ||
        err.message.includes('entityMetadata') ||
        err.message.includes('ERR_OUT_OF_RANGE') ||
        err.message.includes('protodef')
    ) {
        return;
    }
    originalConsoleError('\x1b[31m[Uncaught Exception]\x1b[0m', err);
});

const mineflayer = require('mineflayer');
const physics = require('mineflayer-physics');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const movements = require('mineflayer-pathfinder').Movements;
const GoalBlock = require('mineflayer-pathfinder').goals;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');
const STATUS_PATH = path.join(__dirname, '.bot_status.json');
const DEFAULT_PORT = 25565;

let accountDatabase = {};

function loadDatabase() {
    if (!fs.existsSync(DB_PATH)) return;
    try {
        accountDatabase = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
        console.error('Failed to parse database.json, resetting database.');
        accountDatabase = {};
    }
}

function saveDatabase() {
    fs.writeFileSync(DB_PATH, JSON.stringify(accountDatabase, null, 4));
}

function getOrCreatePassword(username) {
    if (accountDatabase[username]) {
        console.log('\x1b[32m[Database] Found existing password for user "' + username + '". Using stored login credentials.\x1b[0m');
        return accountDatabase[username];
    }
    const password = crypto.randomBytes(6).toString('hex');
    accountDatabase[username] = password;
    saveDatabase();
    console.log('\x1b[33m[Database] Created NEW profile for user "' + username + '". Password stored securely in database.json\x1b[0m');
    return password;
}

function printHelpMenu() {
    console.log('\n\x1b[36m=================== Mineflayer Bot Help Menu ===================\x1b[0m');
    console.log(' \x1b[1mUsage:\x1b[0m node bot.js <command> [arguments]');
    console.log('\n \x1b[33mnode bot.js <serverip> <botname> [version]\x1b[0m -> Run a bot');
    console.log(' \x1b[33mnode bot.js list\x1b[0m                          -> List saved profiles');
    console.log(' \x1b[33mnode bot.js serverlist\x1b[0m                    -> Show online players (offline query)');
    console.log(' \x1b[33mnode bot.js help\x1b[0m                          -> Show this help menu');
    console.log('\n \x1b[1mActive Terminal Commands (When bot is running):\x1b[0m');
    console.log('   \x1b[32m!say <msg>\x1b[0m   -> Send a message to the in-game chat');
    console.log('   \x1b[32m!goto <x> <y> <z>\x1b[0m -> Pathfind to coordinates (Y optional)');
    console.log('   \x1b[32m!serverlist\x1b[0m  -> Fetch live players currently in your lobby');
    console.log('   \x1b[32m!list\x1b[0m        -> Display your locally saved bot credentials');
    console.log('   \x1b[32m!help\x1b[0m        -> Display the active commands console sheet');
    console.log('\x1b[36m================================================================\x1b[0m\n');
}

function printSavedProfiles() {
    const savedUsernames = Object.keys(accountDatabase);
    console.log('\n\x1b[36m=== Saved Bot Profiles ===\x1b[0m');
    if (savedUsernames.length === 0) {
        console.log(' No bots created yet! Run a bot first to save a profile.');
    } else {
        savedUsernames.forEach(function (username, index) {
            console.log(' ' + (index + 1) + '. \x1b[32m' + username + '\x1b[0m (Password: ' + accountDatabase[username] + ')');
        });
    }
    console.log('\x1b[36m==========================\x1b[0m\n');
}

function printLivePlayers(host, players) {
    console.log('\n\x1b[36m=== Online Players on ' + host + ' ===\x1b[0m');
    if (!players || players.length === 0) {
        console.log(' No players online or player list not synchronized yet.');
    } else {
        players.forEach(function (p, idx) {
            console.log(' ' + (idx + 1) + '. ' + p);
        });
    }
    console.log('\x1b[36m=========================================\x1b[0m\n');
}

function printServerListOffline() {
    if (!fs.existsSync(STATUS_PATH)) {
        console.log('\n\x1b[31m[Status Error] Cannot get server list: The bot is currently completely offline/not running!\x1b[0m\n');
        process.exit(1);
    }
    try {
        const statusData = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
        printLivePlayers(statusData.host, statusData.players);
    } catch (e) {
        console.log('\x1b[31mError reading bot memory matrix.\x1b[0m');
    }
}

const actionArg = process.argv[2];

if (actionArg === 'help' || actionArg === '--help' || actionArg === '-h') {
    printHelpMenu();
    process.exit(0);
}

if (actionArg === 'list') {
    loadDatabase();
    printSavedProfiles();
    process.exit(0);
}

if (actionArg === 'serverlist') {
    printServerListOffline();
    process.exit(0);
}

const serverIp = process.argv[2];
const botUsername = process.argv[3];
const customVersion = process.argv[4];

if (!serverIp || !botUsername) {
    console.error('\x1b[31mError: Missing parameters!\x1b[0m');
    console.log('Type \x1b[33mnode bot.js help\x1b[0m to view the manual.');
    process.exit(1);
}

loadDatabase();
const sessionPassword = getOrCreatePassword(botUsername);

const botConfig = {
    host: serverIp,
    port: DEFAULT_PORT,
    username: botUsername,
    version: customVersion || false,
};

let bot;
let consoleListenerActive = false;

function createBotInstance() {
    console.log('Connecting to ' + botConfig.host + ':' + botConfig.port + ' as ' + botConfig.username + '...');
    try {
        bot = mineflayer.createBot(botConfig);
        bot.loadPlugin(physics.plugin);
        bot.loadPlugin(pathfinder);
        setupBotEvents();
    } catch (err) {
        console.error('\n[Critical Error] Failed to initialize bot instance:');
        console.error(err.message);
        process.exit(1);
    }
}

function setupBotEvents() {
    bot.once('spawn', onSpawn);
    bot.on('death', onDeath);
    bot.on('kicked', onKicked);
    bot.on('playerJoined', updateLiveStatus);
    bot.on('playerLeft', updateLiveStatus);
    bot.on('message', onMessage);
    bot.on('error', function (err) {
        console.error('Bot runtime error:', err.message);
    });
    bot.on('end', function () {
        onDisconnect();
    });
}

function onSpawn() {
    console.log('\x1b[32m[Handshake] Successfully connected! Running version: ' + bot.version + '\x1b[0m');
    console.log(bot.username + ' spawned. Use \x1b[33m!say <message>\x1b[0m or run live terminal commands here!');

    if (bot.physics) {
        bot.physics.enabled = true;
        bot.physics.ticksPerSecond = 20;
    }

    const defaultMove = new movements(bot);
    bot.pathfinder.setMovements(defaultMove);

    setupConsoleInput();
    setupChatLogger();
    startAntiAFK();
    updateLiveStatus();
}

function onDeath() {
    console.log('\n\x1b[31m[DEATH ALERT] ' + bot.username + ' was killed!\x1b[0m');
    if (bot.combat && bot.combat.attacker) {
        const killerName = bot.combat.attacker.username || bot.combat.attacker.displayName || bot.combat.attacker.name || 'Unknown Entity';
        console.log('\x1b[31m[Killer Identity] Slain by: ' + killerName + '\x1b[0m\n');
    } else {
        console.log('\x1b[31m[Killer Identity] Died from environmental or unknown damage sources.\x1b[0m\n');
    }
}

function onKicked(reason, loggedIn) {
    console.log('\n\x1b[31m[KICKED] ' + bot.username + ' was kicked from the server!\x1b[0m');
    if (reason) {
        console.log('\x1b[31m[Reason] ' + reason + '\x1b[0m');
    }
    if (loggedIn) {
        console.log('\x1b[33m[Status] Bot was logged in when kicked.\x1b[0m');
    } else {
        console.log('\x1b[33m[Status] Bot was NOT logged in when kicked.\x1b[0m');
    }
    console.log('');
}

function onDisconnect() {
    console.log('Disconnected from server. Reconnecting in 10 seconds...');
    if (fs.existsSync(STATUS_PATH)) fs.unlinkSync(STATUS_PATH);
    setTimeout(createBotInstance, 10000);
}

function onMessage(jsonMsg) {
    const cleanMessage = jsonMsg.toString().toLowerCase().trim();
    const isRegister = cleanMessage.includes('register') && (cleanMessage.includes('/register') || cleanMessage.includes('!register'));
    const isLogin = cleanMessage.includes('login') && (cleanMessage.includes('/login') || cleanMessage.includes('!login'));

    if (isRegister) {
        bot.chat('/register ' + sessionPassword + ' ' + sessionPassword);
    } else if (isLogin) {
        bot.chat('/login ' + sessionPassword);
    }
}

function updateLiveStatus() {
    if (!bot || !bot.players) return;
    const currentPlayers = Object.keys(bot.players);
    const data = {
        host: botConfig.host,
        players: currentPlayers,
    };
    fs.writeFileSync(STATUS_PATH, JSON.stringify(data));
}

function setupChatLogger() {
    bot.on('chat', function (username, message) {
        if (username === bot.username) return;
        console.log('<' + username + '> ' + message);
    });
}

function setupConsoleInput() {
    if (consoleListenerActive) return;
    consoleListenerActive = true;

    process.stdin.on('data', function (data) {
        const input = data.toString().trim();
        if (!input) return;

        if (input.startsWith('!say ')) {
            handleSayCommand(input);
        } else if (input.startsWith('!goto ')) {
            handleGotoCommand(input);
        } else if (input === '!serverlist') {
            handleServerListCommand();
        } else if (input === '!list') {
            printSavedProfiles();
        } else if (input === '!help') {
            printLiveHelp();
        } else if (input.startsWith('!')) {
            console.log('\x1b[33mUnknown live control token command. Type !help to look up usage.\x1b[0m');
        }
    });
}

function handleSayCommand(input) {
    const chatMsg = input.substring(5).trim();
    if (bot && bot.entity && chatMsg) {
        bot.chat(chatMsg);
        console.log('[Sent to Chat] -> ' + chatMsg);
    } else if (!bot || !bot.entity) {
        console.log('\x1b[31mCannot send message: Bot is currently disconnected.\x1b[0m');
    }
}

function handleGotoCommand(input) {
    const coordsStr = input.substring(6).trim();
    const parts = coordsStr.split(/\s+/);
    if (parts.length < 2) {
        console.log('\x1b[31mUsage: !goto <x> <y> <z>  or  !goto <x> <z>\x1b[0m');
        return;
    }

    if (!bot || !bot.entity) {
        console.log('\x1b[31mBot is offline. Cannot pathfind right now.\x1b[0m');
        return;
    }

    const x = parseFloat(parts[0]);
    const z = parseFloat(parts[parts.length - 1]);
    let y;

    if (parts.length >= 3) {
        y = parseFloat(parts[1]);
    } else {
        y = bot.entity.position.y;
        console.log('\x1b[33m[Pathfinder] Y not specified, using current Y: ' + Math.floor(y) + '\x1b[0m');
    }

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
        console.log('\x1b[31mInvalid coordinates. Use numbers only.\x1b[0m');
        return;
    }

    const goal = new GoalBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    console.log('\x1b[36m[Pathfinder] Navigating to (' + x + ', ' + y + ', ' + z + ')...\x1b[0m');

    bot.pathfinder.goto(goal)
        .then(function () {
            console.log('\x1b[32m[Pathfinder] Arrived at (' + x + ', ' + y + ', ' + z + ')!\x1b[0m');
        })
        .catch(function (err) {
            console.log('\x1b[31m[Pathfinder] Failed to reach destination: ' + err.message + '\x1b[0m');
        });
}

function handleServerListCommand() {
    if (bot && bot.players) {
        printLivePlayers(botConfig.host, Object.keys(bot.players));
    } else {
        console.log('\x1b[31mBot is offline. Cannot query players right now.\x1b[0m');
    }
}

function printLiveHelp() {
    console.log('\n\x1b[36m=== Live Session Commands ===\x1b[0m');
    console.log(' \x1b[32m!say <msg>\x1b[0m   -> Speak in Minecraft chat');
    console.log(' \x1b[32m!goto <x> <y> <z>\x1b[0m -> Pathfind to coordinates (Y optional)');
    console.log(' \x1b[32m!serverlist\x1b[0m  -> Fetch current online players natively');
    console.log(' \x1b[32m!list\x1b[0m        -> Read your stored profiles from database.json');
    console.log(' \x1b[32m!help\x1b[0m        -> Print this session list summary');
    console.log('\x1b[36m=============================\x1b[0m\n');
}

function startAntiAFK() {
    const minDelay = 20000;
    const maxDelay = 40000;
    const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    setTimeout(function () {
        if (!bot || !bot.entity) return;

        const actionType = Math.floor(Math.random() * 3);
        switch (actionType) {
            case 0:
                bot.setControlState('jump', true);
                setTimeout(function () {
                    bot.setControlState('jump', false);
                }, 500);
                break;
            case 1:
                bot.look(bot.entity.yaw + 0.5, bot.entity.pitch, true);
                break;
            case 2:
                bot.look(bot.entity.yaw - 0.5, bot.entity.pitch, true);
                break;
        }

        startAntiAFK();
    }, randomDelay);
}

process.on('SIGINT', function () {
    if (fs.existsSync(STATUS_PATH)) fs.unlinkSync(STATUS_PATH);
    process.exit(0);
});

createBotInstance();