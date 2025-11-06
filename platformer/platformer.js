const elementSrcs = [
    'visuals/elements/1.png',
    'visuals/elements/2.png',
    'visuals/elements/3.png',
    'visuals/elements/4.png',
    'visuals/elements/5.png',
    'visuals/elements/6.png',
    'visuals/elements/7.png',
    'visuals/elements/8.png',
    'visuals/elements/9.png',
    'visuals/elements/10.png',
    'visuals/elements/11.png',
    'visuals/elements/12.png',
    'visuals/elements/13.png'
];

let elements = [];
const baseSize = 64;

// Supabase client (existing)
const supabaseUrl = 'https://otlzajtygaifjxikafef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90bHphanR5Z2FpZmp4aWthZmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMjM0ODgsImV4cCI6MjA3NDY5OTQ4OH0.GtIyi1atTO4dqDLFZNtWPMJNjc7BtsSuSil4Odp3RE0';
let client = null;
if (typeof supabase !== 'undefined') {
  const { createClient } = supabase;
  client = createClient(supabaseUrl, supabaseKey);
} else {
  console.error('Supabase library not loaded');
}

// Multiplayer variables
let user = null;
let localPlayer = null;
let otherPlayers = new Map(); // user_id -> Character
let lastSeen = new Map(); // user_id -> timestamp

let gameInitialized = false;
let currentUsername = localStorage.getItem('gameUsername') || null;

const now = () => performance.now();

let canvas;
let ctx;
let mapImage;

function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('Canvas not found');
    return false;
  }
  ctx = canvas.getContext('2d');
  mapImage = new Image();
  mapImage.src = 'map.png';

  // Update ad and button positions
  adX = canvas.width;
  buttonX = canvas.width - 80;
  buttonY = canvas.height - 80;

  // Canvas click handler for button and modals
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check for intro button click
    if (x >= buttonX && x <= buttonX + buttonSize && y >= buttonY && y <= buttonY + buttonSize) {
        if (isPlaying) return;
        isPlaying = true;
        showBadge = false;

        audio1.play().then(() => {
            audio1.onended = () => {
                audio2.play().then(() => {
                    audio2.onended = () => {
                        audio3.play().then(() => {
                            audio3.onended = () => {
                                isPlaying = false;
                            };
                        }).catch(e => {
                            console.error('Audio 3 play failed:', e);
                            isPlaying = false;
                        });
                    };
                }).catch(e => {
                    console.error('Audio 2 play failed:', e);
                    isPlaying = false;
                });
            };
        }).catch(e => {
            console.error('Audio 1 play failed:', e);
            isPlaying = false;
        });
        return;
    }
    
    // Handle modal clicks
    if (showProfileModal) {
        const modalX = (canvas.width - 400) / 2;
        const modalY = (canvas.height - 300) / 2;
        const closeBtnX = modalX + 370;
        const closeBtnY = modalY + 10;
        const closeBtnSize = 20;

        // Close button click
        if (x >= closeBtnX && x <= closeBtnX + closeBtnSize && y >= closeBtnY && y <= closeBtnY + closeBtnSize) {
            showProfileModal = false;
            return;
        }

        // Outside modal click
        if (x < modalX || x > modalX + 400 || y < modalY || y > modalY + 300) {
            showProfileModal = false;
        }
        return;
    }

    if (showInventoryModal) {
        const modalX = (canvas.width - 400) / 2;
        const modalY = (canvas.height - 300) / 2;
        const closeBtnX = modalX + 370;
        const closeBtnY = modalY + 10;
        const closeBtnSize = 20;

        // Close button click
        if (x >= closeBtnX && x <= closeBtnX + closeBtnSize && y >= closeBtnY && y <= closeBtnY + closeBtnSize) {
            showInventoryModal = false;
            return;
        }

        // Tab clicks
        const tabY = modalY + 70;
        const tabHeight = 20;
        const tabWidth = 90;
        const tabs = ['Items', 'Materials', 'Tools', 'Equipments'];
        for (let i = 0; i < tabs.length; i++) {
            const tabX = modalX + 20 + i * tabWidth;
            if (x >= tabX && x <= tabX + tabWidth && y >= tabY && y <= tabY + tabHeight) {
                activeInventoryTab = tabs[i];
                return;
            }
        }

        // Outside modal click
        if (x < modalX || x > modalX + 400 || y < modalY || y > modalY + 300) {
            showInventoryModal = false;
        }
        return;
    }
    
    if (showComingSoon) {
        const popupX = (canvas.width - 300) / 2;
        const popupY = (canvas.height - 100) / 2;
        const closeBtnX = popupX + 270;
        const closeBtnY = popupY + 10;
        const closeBtnSize = 20;

        // Close button click
        if (x >= closeBtnX && x <= closeBtnX + closeBtnSize && y >= closeBtnY && y <= closeBtnY + closeBtnSize) {
            showComingSoon = false;
            return;
        }

        // Outside popup click
        if (x < popupX || x > popupX + 300 || y < popupY || y > popupY + 100) {
            showComingSoon = false;
        }
    }
  });

  return true;
}

class Element {
  constructor(id, src, initial_x, world_y, scale = 1.0, velocity_x = -2.0, created_at) {
    this.id = id;
    this.image = new Image();
    this.image.src = src;
    this.initial_x = initial_x;
    this.world_y = world_y;
    this.scale = scale;
    this.velocity_x = velocity_x;
    this.created_at = new Date(created_at || Date.now()).getTime();
    this.baseSize = 64;
    this.width = this.baseSize * this.scale;
    this.height = this.baseSize * this.scale;
    this.image.onload = () => console.log('Element image loaded:', src);
    this.image.onerror = () => console.error('Element image failed:', src);
  }

  get current_x() {
    const timeElapsed = (now() - this.created_at) / 1000; // seconds
    return this.initial_x + (this.velocity_x * timeElapsed * 60); // 60fps
  }

  shouldRemove() {
    return this.current_x < -2000;
  }

  async removeFromDB() {
    if (!this.id || !client) return;
    try {
      const { error } = await client
        .from('floating_elements')
        .delete()
        .eq('id', this.id);
      if (error) {
        console.error('Delete error for element', this.id, ':', error);
      } else {
        console.log('Deleted element:', this.id);
      }
    } catch (e) {
      console.error('Delete exception for element', this.id, ':', e);
    }
  }
}

// Character class (modified to support multiplayer)
class Character {
    constructor(userId = null, username = 'Player') {
        this.userId = userId;
        this.username = username;
        this.spriteType = userId ? (Math.abs([...userId].reduce((a, c) => a + c.charCodeAt(0), 0)) % 9 + 1) : 1;
        this.x = 100;
        this.y = 400;
        this.targetX = this.x;
        this.targetY = this.y;
        this.lastUpdateTime = now();
        this.lastSaveTime = 0;
        this.width = 128;
        this.height = 128;
        this.speed = 5;
        this.velocityX = 0;
        this.velocityY = 0;
        this.jumping = false;
        this.direction = 1; // 1 for right, -1 for left
        this.friction = 0.9;
        this.airFriction = 0.98;
        
        // Sprite animation
        this.currentAction = 'stand';
        this.frameIndex = 0;
        this.tickCount = 0;
        this.ticksPerFrame = 10;
        
        // Location
        this.currentLocation = {name: 'Citadel Outskirts', x: 100, y: 400};
        this.locationName = 'Citadel Outskirts';
        
        // Spritesheets
        this.spritesheets = {
            walking: {
                image: new Image(),
                frames: 8
            },
            stand: {
                image: new Image(),
                frames: 1
            }
        };
        
        // Load sprites (standardized)
        this.spritesheets.stand.image.src = 'stand-sprite.png';
        this.spritesheets.walking.image.src = 'walking-sprite.png';
        
        // Add error handling for images
        this.spritesheets.stand.image.onerror = () => console.error('Failed to load stand-sprite.png');
        this.spritesheets.walking.image.onerror = () => console.error('Failed to load walking-sprite.png');
        
        // Platform
        this.groundY = this.y;
    }
    
    // Add a new action spritesheet
    addAction(name, imagePath, frameCount) {
        this.spritesheets[name] = {
            image: new Image(),
            frames: frameCount
        };
        this.spritesheets[name].image.src = imagePath;
    }
    
    // Change the current action
    setAction(action) {
        if (this.spritesheets[action]) {
            this.currentAction = action;
            this.frameIndex = 0;
        }
    }
    
    // Update character position and animation
    update(currentGravity) {
        const deltaTime = (now() - this.lastUpdateTime) / 1000; // seconds
        
        if (this.userId && this.userId !== user.id) {
            // For remote players: Interpolate to target, or extrapolate if stale
            this.lastUpdateTime = now();
            const timeSince = (now() - lastSeen.get(this.userId) || 0) / 1000;
            if (timeSince < 0.1) {
                // Recent update: lerp fast
                const lerp = 0.5;
                this.x += (this.targetX - this.x) * lerp;
                this.y += (this.targetY - this.y) * lerp;
            } else if (timeSince < 0.5) {
                // Stale: predict based on direction/speed
                this.x += this.direction * this.speed * deltaTime;
                this.y += this.velocityY * deltaTime;
                this.velocityY += currentGravity * deltaTime;
            } else {
                // Too stale: snap to target
                this.x = this.targetX;
                this.y = this.targetY;
            }
        } else {
            // Local player
            this.x += this.velocityX;
            this.velocityX *= this.jumping ? this.airFriction : this.friction;
            
            if (this.jumping) {
                this.y += this.velocityY;
                this.velocityY += currentGravity;
                if (this.y >= this.groundY) {
                    this.y = this.groundY;
                    this.jumping = false;
                    this.velocityY = 0;
                    this.velocityX *= 0.5;
                }
            }
        }
        
        // Update location
        this.currentLocation.x = this.x;
        this.currentLocation.y = this.y;
        
        // Save position to localStorage every second for persistence
        if ((this.userId === user?.id || !this.userId) && (now() - this.lastSaveTime) > 1000) {
            localStorage.setItem('playerPosition', JSON.stringify({x: Math.round(this.x), y: Math.round(this.y)}));
            this.lastSaveTime = now();
        }
        
        // Update animation
        this.tickCount++;
        if (this.tickCount > this.ticksPerFrame) {
            this.tickCount = 0;
            this.frameIndex = (this.frameIndex + 1) % this.spritesheets[this.currentAction].frames;
        }
    }
    
    // Sync to DB (for local player only)
    async syncToDB() {
        if (!this.userId || !user || !user.id || !client) return;
        
        try {
            const { error } = await client
                .from('players')
                .upsert({
                    user_id: this.userId,
                    x: this.x,
                    y: this.y,
                    direction: this.direction,
                    username: this.username,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
            
            if (error) {
                console.error('Sync error for ' + this.userId + ':', error.message);
            } else {
                console.log('Synced ' + this.userId + ': x=' + this.x.toFixed(0) + ', y=' + this.y.toFixed(0) + ', direction=' + this.direction);
            }
        } catch (e) {
            console.error('Sync exception for ' + this.userId + ':', e);
        }
    }
    
    // Draw the character
    draw(cameraX) {
        const sprite = this.spritesheets[this.currentAction];
        if (!sprite.image.complete) return;
        
        ctx.save();
        ctx.translate(this.x - cameraX, this.y);
        
        // Draw username above head (before flip so text doesn't flip)
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(this.username, this.width / 2, -10);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        
        // Flip image if facing left
        if (this.direction === -1) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-this.width, 0);
            // Draw current frame
            ctx.drawImage(
                sprite.image,
                this.frameIndex * this.width,
                0,
                this.width,
                this.height,
                0,
                0,
                this.width,
                this.height
            );
            ctx.restore();
        } else {
            // Draw current frame
            ctx.drawImage(
                sprite.image,
                this.frameIndex * this.width,
                0,
                this.width,
                this.height,
                0,
                0,
                this.width,
                this.height
            );
        }
        
        ctx.restore();
    }
    
    // Move character left
    moveLeft() {
        this.velocityX = -this.speed;
        this.direction = -1;
        if (this.currentAction !== 'walking' && !this.jumping) {
            this.setAction('walking');
        }
    }
    
    // Move character right
    moveRight() {
        this.velocityX = this.speed;
        this.direction = 1;
        if (this.currentAction !== 'walking' && !this.jumping) {
            this.setAction('walking');
        }
    }
    
    // Make character jump with physics
    jump() {
        if (!this.jumping) {
            this.jumping = true;
            this.velocityY = -20;
            // Add horizontal physics to jump based on direction and current velocity
            this.velocityX += this.direction * 3 + (Math.random() - 0.5) * 2; // Small random horizontal kick
        }
    }
    
    // Update from DB data (for remote players)
    updateFromData(data) {
        this.lastUpdateTime = now();
        this.targetX = data.x || 100;
        this.targetY = data.y || 400;
        this.direction = data.direction || 1;
        this.username = data.username || this.username || 'Player';
        this.currentLocation = {name: 'Citadel Outskirts', x: this.targetX, y: this.targetY};
        this.locationName = 'Citadel Outskirts';
        // Note: Other fields not synced for simplicity
    }
}

// Wrapped initMultiplayer to ignore errors
async function initMultiplayer() {
    if (!client) {
        console.log('No Supabase client, running single-player');
        localPlayer = new Character(null, currentUsername);
        setupElements(); // Setup elements without multiplayer
        gameLoop();
        return;
    }

    try {
        // Check for existing session first
        let { data: { session }, error: getError } = await client.auth.getSession();
        if (getError) {
            console.error('Get session error:', getError);
        }
        
        if (!session) {
            // Sign in anonymously only if no session
            const { data: { session: newSession }, error: signInError } = await client.auth.signInAnonymously();
            if (signInError) {
                console.error('Auth error:', signInError);
            } else {
                session = newSession;
            }
        }
        
        if (!session) {
            console.log('Running in single player mode');
            localPlayer = new Character(null, currentUsername);
            const saved = localStorage.getItem('playerPosition');
            if (saved) {
                const pos = JSON.parse(saved);
                localPlayer.x = pos.x;
                localPlayer.y = pos.y;
                localPlayer.targetX = pos.x;
                localPlayer.targetY = pos.y;
                localPlayer.currentLocation = {name: 'Citadel Outskirts', x: pos.x, y: pos.y};
                localPlayer.locationName = 'Citadel Outskirts';
            }
            setupElements();
            gameLoop();
            return;
        }
        
        user = session.user;
        console.log('Signed in as:', user.id);
        
        // Load existing position from DB or fallback to localStorage
        let initialData = null;
        try {
            const { data: myData, error: fetchError } = await client
                .from('players')
                .select('x, y, direction, username')
                .eq('user_id', user.id)
                .single();
            
            if (!fetchError && myData) {
                initialData = myData;
                console.log('Loaded existing position from DB');
            } else {
                // Fallback to localStorage
                const saved = localStorage.getItem('playerPosition');
                if (saved) {
                    const pos = JSON.parse(saved);
                    initialData = {x: pos.x, y: pos.y, direction: 1, username: currentUsername};
                    console.log('Loaded position from localStorage');
                }
            }
        } catch (e) {
            console.log('Players table not available, using single-player position');
            const saved = localStorage.getItem('playerPosition');
            if (saved) {
                const pos = JSON.parse(saved);
                initialData = {x: pos.x, y: pos.y, direction: 1, username: currentUsername};
            }
        }
        
        // Create local player
        localPlayer = new Character(user.id, currentUsername);
        if (initialData) {
            localPlayer.x = initialData.x;
            localPlayer.y = initialData.y;
            localPlayer.targetX = initialData.x;
            localPlayer.targetY = initialData.y;
            localPlayer.direction = initialData.direction || 1;
            localPlayer.currentLocation = {name: 'Citadel Outskirts', x: initialData.x, y: initialData.y};
            localPlayer.locationName = 'Citadel Outskirts';
        }
        
        // Initial sync (try-catch)
        try {
            await localPlayer.syncToDB();
        } catch (e) {
            console.log('Initial sync skipped due to DB error');
        }
        
        // Fetch initial other players (try-catch)
        try {
            console.log('Fetching initial players...');
            const { data: initialPlayers, error: initialFetchError } = await client
                .from('players')
                .select('user_id, x, y, direction, updated_at, username')
                .neq('user_id', user.id);
            
            let loadedCount = 0;
            if (initialFetchError) {
                console.log('Initial fetch skipped, single-player');
            } else if (initialPlayers) {
                initialPlayers.forEach(p => {
                    if (p && p.user_id && !otherPlayers.has(p.user_id)) {
                        const remotePlayer = new Character(p.user_id, p.username || 'Player');
                        remotePlayer.updateFromData(p);
                        otherPlayers.set(p.user_id, remotePlayer);
                        lastSeen.set(p.user_id, now());
                        loadedCount++;
                    }
                });
                console.log(`Loaded ${loadedCount} other players from DB`);
            }
        } catch (e) {
            console.log('Players fetch skipped');
        }
        
        // Realtime subscription for players (try-catch)
        try {
            const channel = client
                .channel('players')
                .on('postgres_changes', 
                    { 
                        event: { type: 'INSERT', schema: 'public', table: 'players' }
                    },
                    (payload) => {
                        const data = payload.new;
                        if (data && data.user_id && data.user_id !== user.id) {
                            if (!otherPlayers.has(data.user_id)) {
                                const remotePlayer = new Character(data.user_id, data.username || 'Player');
                                otherPlayers.set(data.user_id, remotePlayer);
                            }
                            otherPlayers.get(data.user_id).updateFromData(data);
                            lastSeen.set(data.user_id, now());
                        }
                    }
                )
                .on('postgres_changes', 
                    { 
                        event: { type: 'UPDATE', schema: 'public', table: 'players' }
                    },
                    (payload) => {
                        const data = payload.new;
                        if (data && data.user_id && data.user_id !== user.id) {
                            if (otherPlayers.has(data.user_id)) {
                                otherPlayers.get(data.user_id).updateFromData(data);
                            } else {
                                const remotePlayer = new Character(data.user_id, data.username || 'Player');
                                remotePlayer.updateFromData(data);
                                otherPlayers.set(data.user_id, remotePlayer);
                                lastSeen.set(data.user_id, now());
                            }
                            lastSeen.set(data.user_id, now());
                        }
                    }
                )
                .subscribe();
        } catch (e) {
            console.log('Players subscription skipped');
        }

    } catch (e) {
        console.log('Multiplayer init failed, running single-player with elements');
    }

    // Setup elements realtime (always)
    setupElements();

    gameLoop();
}

function setupElements() {
    if (!client) {
        console.log('No client for elements, running without sync');
        // Start local spawning for demo
        setInterval(() => {
            const src = elementSrcs[Math.floor(Math.random() * elementSrcs.length)];
            const scale = 0.5 + Math.random() * 2.5;
            const world_y = Math.random() * 100;
            const initial_x = 5000 + Math.random() * 2000;
            const velocity_x = -1.0 - Math.random() * 3.0;
            const created_at = Date.now();
            const newElement = new Element(null, src, initial_x, world_y, scale, velocity_x, created_at);
            elements.push(newElement);
            console.log('Local element added for demo');
        }, 15000);
        // Local cleanup
        setInterval(() => {
            elements = elements.filter(el => !el.shouldRemove());
        }, 1000);
        return;
    }

    // Elements realtime subscription
    try {
        const channel = client
            .channel('floating_elements')
            .on('postgres_changes', 
                { 
                    event: { type: 'INSERT', schema: 'public', table: 'floating_elements' }
                },
                (payload) => {
                    try {
                        const data = payload.new;
                        if (data && data.id && !elements.find(el => el.id === data.id)) {
                            const newElement = new Element(
                                data.id,
                                data.src,
                                data.world_x, // initial
                                data.world_y,
                                data.scale,
                                data.velocity_x,
                                data.created_at
                            );
                            elements.push(newElement);
                            console.log('Synced element added:', data.id);
                        }
                    } catch (e) {
                        console.error('INSERT handler error:', e);
                    }
                }
            )
            .on('postgres_changes', 
                { 
                    event: { type: 'DELETE', schema: 'public', table: 'floating_elements' }
                },
                (payload) => {
                    try {
                        const data = payload.old;
                        if (data && data.id) {
                            const index = elements.findIndex(el => el.id === data.id);
                            if (index !== -1) {
                                elements.splice(index, 1);
                                console.log('Synced element removed:', data.id);
                            }
                        }
                    } catch (e) {
                        console.error('DELETE handler error:', e);
                    }
                }
            );

        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log('Elements realtime ready');
        });
    } catch (e) {
        console.error('Elements subscription failed:', e);
    }

    // Spawning interval
    setInterval(async () => {
        if (!client) return;
        try {
            const src = elementSrcs[Math.floor(Math.random() * elementSrcs.length)];
            const scale = 0.5 + Math.random() * 2.5;
            const world_y = Math.random() * 100;
            const initial_x = 5000 + Math.random() * 2000; // Fixed
            const velocity_x = -1.0 - Math.random() * 3.0;
            const { data, error } = await client
                .from('floating_elements')
                .insert({
                    src,
                    world_x: initial_x,
                    world_y,
                    scale,
                    velocity_x,
                    created_at: new Date().toISOString()
                });
            if (error) {
                console.error('Spawn error:', error);
            } else {
                console.log('Spawned new element:', data[0].id);
            }
        } catch (e) {
            console.error('Spawn exception:', e);
        }
    }, 15000);

    // Periodic cleanup
    setInterval(async () => {
        for (let i = elements.length - 1; i >= 0; i--) {
            if (elements[i].shouldRemove()) {
                await elements[i].removeFromDB();
                elements.splice(i, 1);
            }
        }
    }, 1000);
}

// Cleanup on unload
window.addEventListener('beforeunload', async () => {
    try {
        if (localPlayer && user && client) {
            await client.from('players').delete().eq('user_id', user.id);
        }
    } catch (e) {}
    if (client) {
        await client.removeAllChannels();
    }
});

let cameraX = 0;
let moveFrameCount = 0;

// Gravity variables
let gravityTime = 0;
let currentGravity = 1;
const gravityBase = 1;
const gravityMax = 2.0;

let lastFrameTime = 0;

// Handle keyboard input
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    
    // Reset to stand when not moving
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') && 
        !keys.ArrowLeft && !keys.ArrowRight && !keys.a && !keys.d) {
        if (localPlayer) localPlayer.setAction('stand');
    }
});

// Game loop
function gameLoop() {
    if (!localPlayer) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Handle input
    if (keys.ArrowLeft || keys.a) {
        localPlayer.moveLeft();
    }
    if (keys.ArrowRight || keys.d) {
        localPlayer.moveRight();
    }
    if (keys.Space || keys.ArrowUp || keys.w) {
        localPlayer.jump();
    }
    
    // Update gravity
    gravityTime++;
    if (gravityTime > 1200) {
        currentGravity = Math.random() * gravityMax;
        gravityTime = 0;
    }
    
    // Update all players
    localPlayer.update(currentGravity);
    otherPlayers.forEach(player => player.update(currentGravity));
    
    // Update camera
    cameraX = localPlayer.x - canvas.width / 2;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    if (mapImage.complete && mapImage.naturalWidth > 0) {
        const parallaxSpeed = 0.3;
        let bgX = (-cameraX * parallaxSpeed) % mapImage.naturalWidth;
        if (bgX < 0) bgX += mapImage.naturalWidth;
        const mapWidth = mapImage.naturalWidth;
        const mapHeight = canvas.height;
        
        ctx.drawImage(mapImage, Math.round(bgX - 2 * mapWidth), 0, mapWidth, mapHeight);
        ctx.drawImage(mapImage, Math.round(bgX - mapWidth), 0, mapWidth, mapHeight);
        ctx.drawImage(mapImage, Math.round(bgX), 0, mapWidth, mapHeight);
    }

    // Draw elements
    ctx.save();
    ctx.translate(-cameraX, 0);
    elements.forEach(el => {
        if (el.image.complete && el.image.naturalWidth > 0) {
            ctx.drawImage(el.image, el.current_x, el.world_y, el.width, el.height);
        }
    });
    ctx.restore();
    
    // Draw other players
    ctx.save();
    ctx.translate(-cameraX, 0);
    otherPlayers.forEach(player => {
        if (player && player.x != null && player.y != null) {
            player.draw(0);
        }
    });
    ctx.restore();
    
    // Draw local player
    ctx.save();
    ctx.translate(-cameraX, 0);
    localPlayer.draw(0);
    ctx.restore();
    
    // Draw UI
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`Gravity: ${currentGravity.toFixed(1)}`, 10, 30);
    ctx.fillText(`Players: ${otherPlayers.size + 1}`, 10, 50);
    ctx.fillText(`Location: ${localPlayer.currentLocation.name} (${localPlayer.currentLocation.x.toFixed(0)}, ${localPlayer.currentLocation.y.toFixed(0)})`, 10, 70);
    ctx.fillText(`Elements: ${elements.length}`, 10, 90);

    // Draw version stamp
    ctx.save();
    const stampX = canvas.width - 20;
    const stampY = 40;
    ctx.translate(stampX, stampY);
    ctx.rotate(-Math.PI / 18);
    ctx.fillStyle = 'yellow';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('0.4v', 0, 0);
    ctx.restore();

    requestAnimationFrame(gameLoop);
}

let adImage = new Image();
adImage.src = 'ads/youradshere.png';
let adLoaded = false;
let adVisible = false;
let adX = 800; // default before init
let adY = 0;
const adSpeed = -2;
let adWidth = 0;
const adHeight = 270;
let adTimer = 0;
const adDuration = 300; // ~5s at 60fps

adImage.onload = function() {
    adLoaded = true;
    adWidth = adHeight * (this.naturalWidth / this.naturalHeight);
    console.log('Ad image loaded successfully');
};

adImage.onerror = function() {
    console.error('Ad image failed to load');
};

const introImage = new Image();
introImage.src = 'visuals/intro.png';
let introLoaded = false;
introImage.onload = () => {
    introLoaded = true;
};

let showBadge = true;

let buttonX = 720; // default before init
let buttonY = 520; // default for 800x600
const buttonSize = 80;

function startAdFlight() {
    if (!adLoaded) {
        console.log('Ad not loaded yet');
        return;
    }
    
    adVisible = true;
    adTimer = 0;
    adX = canvas ? canvas.width : 800;
    adY = 0;
}

// Initial ad flight after 1s
setTimeout(() => {
    startAdFlight();
}, 1000);

// Start new ads every 10 seconds
setInterval(startAdFlight, 10000);

const audio1 = new Audio('audio/Cocintro/1.wav');
const audio2 = new Audio('audio/Cocintro/2.wav');
const audio3 = new Audio('audio/Cocintro/3.wav');

let audioReadyCount = 0;
let audioLoaded = false;

function checkAllAudioLoaded() {
    if (audioReadyCount === 3) {
        audioLoaded = true;
    }
}

audio1.addEventListener('canplaythrough', () => {
    audioReadyCount++;
    checkAllAudioLoaded();
});

audio2.addEventListener('canplaythrough', () => {
    audioReadyCount++;
    checkAllAudioLoaded();
});

audio3.addEventListener('canplaythrough', () => {
    audioReadyCount++;
    checkAllAudioLoaded();
});

let isPlaying = false;

// Modal states
let showProfileModal = false;
let showInventoryModal = false;
let showComingSoon = false;
let comingSoonTimer = 0;
let activeInventoryTab = 'Items'; // Default tab for inventory

document.addEventListener('DOMContentLoaded', async () => {
    if (!initCanvas()) {
        console.error('Failed to initialize canvas');
        return;
    }

    // Handle username modal
    const usernameModal = document.getElementById('usernameModal');
    const usernameForm = document.getElementById('usernameForm');
    const usernameInput = document.getElementById('usernameInput');
    const usernameMessage = document.getElementById('usernameMessage');
    const usernameClose = usernameModal.querySelector('.close');

    function showUsernameModal() {
        usernameModal.style.display = 'flex';
        usernameInput.focus();
    }

    function hideUsernameModal() {
        usernameModal.style.display = 'none';
        usernameMessage.style.display = 'none';
    }

    usernameClose.addEventListener('click', hideUsernameModal);

    window.addEventListener('click', (e) => {
        if (e.target === usernameModal) {
            hideUsernameModal();
        }
    });

    usernameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const usernameRegex = /^[a-zA-Z0-9]{3,20}$/;

        if (!usernameRegex.test(username)) {
            usernameMessage.textContent = 'Username must be 3-20 alphanumeric characters.';
            usernameMessage.style.color = 'red';
            usernameMessage.style.display = 'block';
            return;
        }

        localStorage.setItem('gameUsername', username);
        currentUsername = username;

        hideUsernameModal();
        await initMultiplayer();
    });

    // Show modal if no username, else init
    if (!currentUsername) {
        showUsernameModal();
    } else {
        await initMultiplayer();
    }
    
    document.getElementById('profileBtn').addEventListener('click', () => {
        showProfileModal = true;
        showInventoryModal = false;
        showComingSoon = false;
    });

    // Inventory Modal (HTML-based)
    const inventoryModalEl = document.getElementById('inventoryModal');
    const inventoryClose = inventoryModalEl.querySelector('.close');
    const inventoryOverlay = inventoryModalEl.querySelector('.modal-overlay');

    function showInventory() {
        inventoryModalEl.style.display = 'flex';
    }
    function hideInventory() {
        inventoryModalEl.style.display = 'none';
    }

    document.getElementById('inventoryBtn').addEventListener('click', () => {
        // Use HTML modal instead of canvas-drawn one
        showInventory();
        showInventoryModal = false; // keep canvas modal logic disabled
        showProfileModal = false;
        showComingSoon = false;
    });

    // Close via X button
    inventoryClose.addEventListener('click', hideInventory);

    // Close by clicking overlay/background
    inventoryModalEl.addEventListener('click', (e) => {
        if (e.target === inventoryModalEl || e.target.classList.contains('modal-overlay')) {
            hideInventory();
        }
    });

    // Close with ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideInventory();
    });

    document.getElementById('casinoBtn').addEventListener('click', () => {
        showComingSoon = true;
        comingSoonTimer = 300; // 5 seconds at 60fps
        showProfileModal = false;
        showInventoryModal = false;
    });

    document.getElementById('stakeBtn').addEventListener('click', () => {
        showComingSoon = true;
        comingSoonTimer = 300; // 5 seconds at 60fps
        showProfileModal = false;
        showInventoryModal = false;
    });

    // Charles Universe modal wiring
    const galaxyModalEl = document.getElementById('galaxyModal');
    const galaxyClose = galaxyModalEl.querySelector('.close');
    const galaxyOverlay = galaxyModalEl.querySelector('.modal-overlay');

    document.getElementById('charlesBtn').addEventListener('click', () => {
        openGalaxyModal();
    });

    galaxyClose.addEventListener('click', () => {
        closeGalaxyModal();
    });

    galaxyModalEl.addEventListener('click', (e) => {
        if (e.target === galaxyModalEl || e.target.classList.contains('modal-overlay')) {
            closeGalaxyModal();
        }
    });

    // Bison Homes modal wiring
    const bisonModalEl = document.getElementById('bisonModal');
    const bisonClose = bisonModalEl.querySelector('.close');

    document.getElementById('bisonBtn').addEventListener('click', () => {
        bisonModalEl.style.display = 'flex';
    });

    bisonClose.addEventListener('click', () => {
        bisonModalEl.style.display = 'none';
    });

    bisonModalEl.addEventListener('click', (e) => {
        if (e.target === bisonModalEl || e.target.classList.contains('modal-overlay')) {
            bisonModalEl.style.display = 'none';
        }
    });
});

// Airdrop functionality (existing)
const airdropBtn = document.getElementById('airdropBtn');
const airdropModal = document.getElementById('airdropModal');
const closeSpan = document.querySelector('#airdropModal .close');
const walletForm = document.getElementById('walletForm');
const walletInput = document.getElementById('walletInput');
const messageDiv = document.getElementById('message');

airdropBtn.addEventListener('click', (e) => {
    e.preventDefault();
    airdropModal.style.display = 'flex';
});

closeSpan.addEventListener('click', () => {
    airdropModal.style.display = 'none';
    messageDiv.style.display = 'none';
    walletForm.reset();
});

window.addEventListener('click', (e) => {
    if (e.target === airdropModal) {
        airdropModal.style.display = 'none';
        messageDiv.style.display = 'none';
        walletForm.reset();
    }
});

walletForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const walletAddress = walletInput.value.trim();
    if (!walletAddress) {
        showMessage('Please enter a wallet address.', 'error');
        return;
    }
    if (!walletAddress.startsWith('addr1') || walletAddress.length < 50) {
        showMessage('Invalid Cardano wallet address. It should start with "addr1" and be at least 50 characters long.', 'error');
        return;
    }

    if (!client) {
        showMessage('Supabase not available. Please try again later.', 'error');
        return;
    }

    try {
        // Check if wallet already submitted
        const { data: existing, error: checkError } = await client
            .from('airdrop_wallets')
            .select('*')
            .eq('wallet_address', walletAddress)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is no rows found
            throw checkError;
        }

        if (existing) {
            showMessage('This wallet has already been submitted for the airdrop.', 'error');
            return;
        }

        // Submit new wallet
        const { data, error: insertError } = await client
            .from('airdrop_wallets')
            .insert({ wallet_address: walletAddress })
            .select()
            .single();

        if (insertError) {
            if (insertError.code === '23505') { // Unique violation
                showMessage('This wallet has already been submitted for the airdrop.', 'error');
            } else {
                throw insertError;
            }
        } else {
            showMessage('Wallet submitted successfully! You will receive the airdrop soon.', 'success');
            walletForm.reset();
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('An error occurred. Please try again later.', 'error');
    }
});

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type === 'success' ? 'success' : 'error';
    messageDiv.style.display = 'block';
}

/* =========================
   Charles Universe - Three.js
   ========================= */

let galaxyCtx = null;

function openGalaxyModal() {
    const modal = document.getElementById('galaxyModal');
    const container = document.getElementById('galaxyCanvasContainer');
    const info = document.getElementById('galaxyInfo');

    if (!modal || !container) return;

    modal.style.display = 'flex';

    if (typeof THREE === 'undefined') {
        if (info) info.textContent = 'Three.js failed to load.';
        return;
    }

    // Ensure previous scene is torn down if any
    if (galaxyCtx) {
        teardownGalaxy(galaxyCtx);
        galaxyCtx = null;
    }

    galaxyCtx = initGalaxy(container, info);
}

function closeGalaxyModal() {
    const modal = document.getElementById('galaxyModal');
    if (galaxyCtx) {
        teardownGalaxy(galaxyCtx);
        galaxyCtx = null;
    }
    if (modal) modal.style.display = 'none';
}

function initGalaxy(container, infoEl) {
    const width = container.clientWidth;
    const height = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
    camera.position.set(0, 40, 150);

    const controls = createOrbitControls(camera, renderer.domElement);
    controls.minDistance = 30;
    controls.maxDistance = 500;
    controls.target.set(0, 0, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0x222233, 1.2);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(80, 120, 60);
    scene.add(ambient, dir);

    // Starfield
    const stars = createStarfield();
    scene.add(stars);

    // Helper arrays
    const clickable = [];
    const planets = [];
    // Details panel element
    const detailsEl = document.createElement('div');
    detailsEl.className = 'planet-details';
    if (infoEl && infoEl.parentElement) {
        infoEl.insertAdjacentElement('afterend', detailsEl);
    }
    // Selection and camera tween state
    let selectedMesh = null;
    let tween = null;
    // Keyboard pan state
    const keysDown = new Set();
    const panVector = new THREE.Vector3();

    // Orbits setup (increased spacing)
    const orbitStart = 40;
    const orbitStep = 20;

    // Create the 4 revealed planets with unique looks
    // 1) Charles Citadel Planet
    planets.push(createRevealedPlanet({
        scene,
        name: 'Charles Citadel Planet',
        radius: 8,
        color: 0x8894a0,
        emissive: 0x0099ff,
        orbitRadius: orbitStart + orbitStep * 0,
        orbitSpeed: 0.0012,
        tilt: 0.1,
        addCitadelSatellites: true
    }, clickable));

    // 2) Lovelace Planet (Ada Lovelace themed - magenta hue with ring)
    planets.push(createRevealedPlanet({
        scene,
        name: 'Lovelace Planet',
        radius: 7,
        color: 0xff55aa,
        emissive: 0x9933cc,
        orbitRadius: orbitStart + orbitStep * 1,
        orbitSpeed: 0.0015,
        tilt: 0.35,
        ring: { inner: 9.5, outer: 12.0, color: 0xffa3da, opacity: 0.5, tilt: 0.6 }
    }, clickable));

    // 3) Epoch (dark basalt with thick ring and tilt)
    planets.push(createRevealedPlanet({
        scene,
        name: 'Epoch',
        radius: 9,
        color: 0x33383d,
        emissive: 0x222233,
        orbitRadius: orbitStart + orbitStep * 2,
        orbitSpeed: 0.0010,
        tilt: 0.5,
        ring: { inner: 12, outer: 15, color: 0xcad2e0, opacity: 0.35, tilt: 0.9 }
    }, clickable));

    // 4) Cornucopians (lush green with multiple moons)
    planets.push(createRevealedPlanet({
        scene,
        name: 'Cornucopians',
        radius: 8,
        color: 0x2ecc71,
        emissive: 0xffd166,
        orbitRadius: orbitStart + orbitStep * 3,
        orbitSpeed: 0.0018,
        tilt: 0.2,
        moons: [
            { radius: 1.3, distance: 12, speed: 0.02, color: 0xc0c0c0 },
            { radius: 1.0, distance: 9, speed: 0.03, color: 0xffe082 },
            { radius: 0.8, distance: 7, speed: 0.028, color: 0xa3d9a5 }
        ]
    }, clickable));

    // Add 10 unrevealed planets (black with question mark)
    for (let i = 0; i < 10; i++) {
        const idx = 4 + i;
        const radius = 4 + Math.random() * 2.5; // 4 - 6.5
        const orbitRadius = orbitStart + orbitStep * idx;
        const orbitSpeed = 0.0008 + idx * 0.00008;

        planets.push(createUnrevealedPlanet({
            scene,
            name: 'Unrevealed',
            radius,
            orbitRadius,
            orbitSpeed
        }, clickable));
    }

    // Raycaster picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(clickable, true);
        if (hits.length > 0) {
            let obj = hits[0].object;
            while (obj && !obj.userData?.name && obj.parent) {
                obj = obj.parent;
            }
            if (obj) {
                focusPlanet(obj);
            }
        }
    };
    
    // Smooth camera tween
    function startTween(fromCam, fromTarget, toCam, toTarget, duration = 900) {
        tween = {
            start: performance.now(),
            duration,
            fromCam,
            fromTarget,
            toCam,
            toTarget
        };
    }
    
    function focusPlanet(mesh) {
        selectedMesh = mesh;
        const targetPos = new THREE.Vector3();
        mesh.getWorldPosition(targetPos);
        const radiusGuess = (mesh.geometry?.parameters?.radius) || 8;
        const desired = Math.max(25, radiusGuess * 4);
        const dir = camera.position.clone().sub(controls.target).normalize();
        const toCam = targetPos.clone().add(dir.multiplyScalar(desired));
        startTween(camera.position.clone(), controls.target.clone(), toCam, targetPos, 900);
        showDetails(mesh.userData?.name || '?', mesh.userData?.description || '');
    }
    
    function showDetails(name, description) {
        if (!detailsEl) return;
        const safeName = String(name);
        const safeDesc = String(description || '');
        detailsEl.innerHTML = `
            <div class="name">${safeName}</div>
            <div class="desc">${safeDesc}</div>
            <button class="dock-btn" id="dockBtn">DOCK on this planet</button>
        `;
        const dockBtn = document.getElementById('dockBtn');
        if (dockBtn) {
            dockBtn.onclick = () => {
                try {
                    alert('Docked on ' + safeName + '!');
                } catch (e) {}
                closeGalaxyModal();
            };
        }
        if (infoEl) {
            infoEl.textContent = safeName;
        }
    }

    renderer.domElement.addEventListener('click', onClick);
    
    // Keyboard controls (WASD / Arrow keys) for panning
    const onKeyDown = (e) => {
        keysDown.add(e.key);
    };
    const onKeyUp = (e) => {
        keysDown.delete(e.key);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Resize handling
    const onResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = Math.max(0.1, w / Math.max(1, h));
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation
    const animate = () => {
        ctx.animationId = requestAnimationFrame(animate);
    
        // Revolutions and self-rotations
        for (const p of planets) {
            if (p.pivot) p.pivot.rotation.y += p.orbitSpeed;
            if (p.mesh) p.mesh.rotation.y += p.selfRotate;
            if (p.satPivot) p.satPivot.rotation.y += 0.02;
            if (p.moons) {
                for (const m of p.moons) {
                    m.pivot.rotation.y += m.speed;
                }
            }
        }
    
        // Keyboard panning
        if (keysDown.size) {
            const dist = camera.position.distanceTo(controls.target);
            const step = Math.max(0.2, dist * 0.01);
            const forward = new THREE.Vector3().subVectors(controls.target, camera.position);
            forward.y = 0;
            if (forward.lengthSq() > 0) forward.normalize();
            const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
            const move = new THREE.Vector3();
    
            if (keysDown.has('w') || keysDown.has('ArrowUp')) move.add(forward);
            if (keysDown.has('s') || keysDown.has('ArrowDown')) move.addScaledVector(forward, -1);
            if (keysDown.has('a') || keysDown.has('ArrowLeft')) move.addScaledVector(right, -1);
            if (keysDown.has('d') || keysDown.has('ArrowRight')) move.add(right);
    
            if (move.lengthSq() > 0) {
                move.normalize().multiplyScalar(step);
                controls.target.add(move);
                camera.position.add(move);
            }
        }
    
        // Camera tween to focus a planet
        if (tween) {
            const t = (performance.now() - tween.start) / tween.duration;
            const k = Math.min(1, Math.max(0, t));
            const ease = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k; // easeInOutQuad
            camera.position.lerpVectors(tween.fromCam, tween.toCam, ease);
            controls.target.lerpVectors(tween.fromTarget, tween.toTarget, ease);
            if (k >= 1) tween = null;
        }
    
        controls.update();
        renderer.render(scene, camera);
    };

    const ctx = {
        renderer,
        scene,
        camera,
        controls,
        container,
        infoEl,
        planets,
        clickable,
        detailsEl,
        animationId: null,
        onClick,
        onResize,
        onKeyDown,
        onKeyUp
    };

    animate();

    return ctx;
}

    function teardownGalaxy(ctx) {
    try {
        if (!ctx) return;
        if (ctx.animationId) cancelAnimationFrame(ctx.animationId);
    
        if (ctx.onResize) window.removeEventListener('resize', ctx.onResize);
        if (ctx.renderer?.domElement && ctx.onClick) {
            ctx.renderer.domElement.removeEventListener('click', ctx.onClick);
        }
        if (ctx.onKeyDown) window.removeEventListener('keydown', ctx.onKeyDown);
        if (ctx.onKeyUp) window.removeEventListener('keyup', ctx.onKeyUp);
        if (ctx.detailsEl && ctx.detailsEl.parentElement) {
            ctx.detailsEl.parentElement.removeChild(ctx.detailsEl);
        }
    
        // Dispose objects
        ctx.scene.traverse((obj) => {
            if (obj.geometry) {
                obj.geometry.dispose?.();
            }
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach((m) => m.dispose?.());
                } else {
                    obj.material.dispose?.();
                }
            }
            if (obj.texture) {
                obj.texture.dispose?.();
            }
        });
    
        ctx.controls?.dispose?.();
        ctx.renderer?.dispose?.();
    
        if (ctx.renderer?.domElement && ctx.container?.contains(ctx.renderer.domElement)) {
            ctx.container.removeChild(ctx.renderer.domElement);
        }
    } catch (e) {
        console.error('Galaxy teardown error:', e);
    }
}

function createStarfield(count = 2500, radius = 1200) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const r = radius * Math.cbrt(Math.random()); // denser near center
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
        color: 0x88aaff,
        size: 1.2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9
    });

    return new THREE.Points(geom, mat);
}

function createRevealedPlanet(spec, clickable) {
    const {
        scene,
        name,
        radius,
        color,
        emissive = 0x000000,
        orbitRadius,
        orbitSpeed,
        tilt = 0,
        ring,
        moons,
        addCitadelSatellites
    } = spec;

    const pivot = new THREE.Object3D();
    pivot.rotation.x = tilt;
    scene.add(pivot);

    const geo = new THREE.SphereGeometry(radius, 48, 48);
    const mat = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.3,
        roughness: 0.7,
        emissive,
        emissiveIntensity: 0.6
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(orbitRadius, 0, 0);
    mesh.userData.name = name;
    mesh.userData.description = spec.description || ('A known world: ' + name + '.');
    pivot.add(mesh);

    let satPivot = null;

    // Optional ring
    if (ring) {
        const ringGeom = new THREE.RingGeometry(ring.inner, ring.outer, 96);
        const ringMat = new THREE.MeshBasicMaterial({
            color: ring.color || 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: ring.opacity ?? 0.5
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.rotation.z = ring.tilt || 0;
        mesh.add(ringMesh);
    }

    // Optional moons
    const moonsOut = [];
    if (Array.isArray(moons)) {
        for (const m of moons) {
            const mPivot = new THREE.Object3D();
            const mGeo = new THREE.SphereGeometry(m.radius, 24, 24);
            const mMat = new THREE.MeshStandardMaterial({
                color: m.color || 0xbbbbbb,
                roughness: 0.9,
                metalness: 0.1
            });
            const mMesh = new THREE.Mesh(mGeo, mMat);
            mMesh.position.set(m.distance, 0, 0);
            mPivot.add(mMesh);
            mesh.add(mPivot);
            moonsOut.push({ pivot: mPivot, speed: m.speed || 0.02 });
        }
    }

    // Citadel satellites: small boxes orbiting
    if (addCitadelSatellites) {
        satPivot = new THREE.Object3D();
        const satCount = 3;
        for (let i = 0; i < satCount; i++) {
            const bGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
            const bMat = new THREE.MeshStandardMaterial({
                color: 0x00aaff,
                emissive: 0x0077ff,
                emissiveIntensity: 0.8,
                metalness: 0.8,
                roughness: 0.2
            });
            const cube = new THREE.Mesh(bGeo, bMat);
            cube.position.set(radius + 3 + i * 1.5, 0, 0);
            satPivot.add(cube);
        }
        mesh.add(satPivot);
    }

    clickable.push(mesh);

    return {
        pivot,
        mesh,
        orbitSpeed,
        selfRotate: 0.004 + Math.random() * 0.004,
        satPivot,
        moons: moonsOut.length ? moonsOut : null
    };
}

function createUnrevealedPlanet(spec, clickable) {
    const { scene, name, radius, orbitRadius, orbitSpeed } = spec;

    const pivot = new THREE.Object3D();
    scene.add(pivot);

    const geo = new THREE.SphereGeometry(radius, 40, 40);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        metalness: 0.0,
        roughness: 1.0
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(orbitRadius, 0, 0);
    mesh.userData.name = name;
    mesh.userData.description = 'Unknown world. Scans incomplete.';
    pivot.add(mesh);

    // Add floating question mark sprite above the planet
    const qSprite = makeQuestionSprite(radius);
    qSprite.position.set(0, radius * 1.6, 0);
    mesh.add(qSprite);

    clickable.push(mesh);

    return {
        pivot,
        mesh,
        orbitSpeed,
        selfRotate: 0.002 + Math.random() * 0.003
    };
}

function makeQuestionSprite(planetRadius) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx2d = canvas.getContext('2d');

    ctx2d.clearRect(0, 0, size, size);
    ctx2d.font = 'bold 96px Arial';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.strokeStyle = 'rgba(0,255,255,0.9)';
    ctx2d.lineWidth = 6;
    ctx2d.strokeText('?', size / 2, size / 2 + 6);
    ctx2d.fillStyle = 'rgba(0,255,255,0.85)';
    ctx2d.fillText('?', size / 2, size / 2 + 6);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    const spriteSize = Math.max(planetRadius * 1.8, 6);
    sprite.scale.set(spriteSize, spriteSize, 1);
    return sprite;
}

/**
 * Create orbit controls with graceful fallback when THREE.OrbitControls
 * (from examples/js/controls/OrbitControls.js) is unavailable.
 */
function createOrbitControls(camera, domElement) {
    // If examples script injected THREE.OrbitControls, use it.
    if (typeof window !== 'undefined' && window.THREE && typeof THREE.OrbitControls === 'function') {
        const c = new THREE.OrbitControls(camera, domElement);
        c.enableDamping = true;
        c.dampingFactor = 0.05;
        return c;
    }

    // Minimal fallback orbit controller (drag to rotate, wheel to zoom)
    const target = new THREE.Vector3(0, 0, 0);
    const offset = new THREE.Vector3().subVectors(camera.position, target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    const ctrl = {
        target,
        minDistance: 10,
        maxDistance: 1000,
        update() {
            const pos = new THREE.Vector3().setFromSpherical(spherical).add(target);
            camera.position.copy(pos);
            camera.lookAt(target);
        },
        dispose() {
            domElement.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            domElement.removeEventListener('wheel', onWheel);
            domElement.removeEventListener('contextmenu', preventContext);
            domElement.style.cursor = '';
        }
    };

    let dragging = false;
    let lastX = 0, lastY = 0;
    const minPhi = 0.01;
    const maxPhi = Math.PI - 0.01;

    function onMouseDown(e) {
        if (e.button !== 0) return;
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        domElement.style.cursor = 'grabbing';
    }

    function onMouseMove(e) {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        spherical.theta -= dx * 0.005; // horizontal
        spherical.phi   -= dy * 0.005; // vertical
        spherical.phi = Math.max(minPhi, Math.min(maxPhi, spherical.phi));
    }

    function onMouseUp() {
        dragging = false;
        domElement.style.cursor = 'grab';
    }

    function onWheel(e) {
        e.preventDefault();
        const scale = 1 + (e.deltaY * 0.001);
        spherical.radius *= scale;
        spherical.radius = Math.max(ctrl.minDistance, Math.min(ctrl.maxDistance, spherical.radius));
    }

    function preventContext(e) { e.preventDefault(); }

    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });
    domElement.addEventListener('contextmenu', preventContext);
    domElement.style.cursor = 'grab';

    // Ensure initial camera alignment
    ctrl.update();
    return ctrl;
}
