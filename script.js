// updated_script_2e6.js
const firebaseConfig = {
  apiKey: "AIzaSyCWNTqnmEG9DyVTNRkQ1clzbwXggJsey",
  authDomain: "memory-game-76ce8.firebaseapp.com",
  databaseURL: "https://memory-game-76ce8-default-rtdb.firebaseio.com",
  projectId: "memory-game-76ce8",
  storageBucket: "memory-game-76ce8.appspot.com",
  messagingSenderId: "1083641868124",
  appId: "1:1083641868124:web:02c45176361f3f2a7cdb99"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const IMGUR_CLIENT_ID = "c82400a2d8c10b3";
let images = [], isPlayerTurn = false, isSinglePlayer = false;
let localPlayer = null, roomId = null, localBoard = [], flipCount = 0;
let timerInterval, startTime;

// We'll store the latest room data here.
let latestRoomData = null;

const joinBtn = document.getElementById("joinRoom");
const playerInput = document.getElementById("playerName");
const roomInput = document.getElementById("roomCode");
const gameBoard = document.getElementById("gameBoard");
const playerLabel = document.getElementById("playerLabel");
const turnLabel = document.getElementById("turnLabel");
const uploadInput = document.getElementById("imageUpload");
const startBtn = document.getElementById("startGame");
const timerDisplay = document.getElementById("timer");
const flipDisplay = document.getElementById("flipCount");
const winMessage = document.getElementById("winMessage");
const results = document.getElementById("results");
const aiToggle = document.getElementById("aiModeToggle");
const aiPromptArea = document.getElementById("aiPromptArea");
const loader = document.getElementById("loader");
const loaderProgress = document.getElementById("loaderProgress");
const progressBar = document.getElementById("progressBar");
const singleToggle = document.getElementById("singlePlayerToggle");

// Toggle single/multiplayer view
singleToggle.addEventListener("change", () => {
  isSinglePlayer = singleToggle.checked;
  document.getElementById("multiplayerSetup").style.display = isSinglePlayer ? "none" : "block";
  turnLabel.textContent = isSinglePlayer ? "You" : "–";
});

aiToggle.addEventListener("change", () => {
  aiPromptArea.style.display = aiToggle.checked ? "block" : "none";
});

// Join room and set up real-time listener for multiplayer mode
joinBtn.addEventListener("click", () => {
  localPlayer = playerInput.value.trim();
  roomId = roomInput.value.trim().toLowerCase();
  if (!localPlayer || !roomId) return alert("Enter name and room.");

  const roomRef = db.ref(`rooms/${roomId}`);
  roomRef.once("value").then(snapshot => {
    const roomData = snapshot.val() || {};
    const players = roomData.players || {};
    if (Object.keys(players).length >= 2 && !players[localPlayer]) {
      return alert("Room full.");
    }
    // Add the player to the room.
    roomRef.child("players").child(localPlayer).set({ joinedAt: Date.now() });
    playerLabel.textContent = localPlayer;

    // Listen for updates in room state.
    roomRef.on("value", snapshot => {
      const data = snapshot.val();
      console.log("Room update:", data);
      if (!data) return;

      latestRoomData = data; // Save for dynamic opponent lookup
      const board = data.board || [];
      const flipped = data.flipped || [];
      const currentTurn = data.currentTurn;

      renderBoard(board, flipped);
      isPlayerTurn = (currentTurn === localPlayer);
      turnLabel.textContent = currentTurn || "–";

      // When two cards are flipped in multiplayer mode,
      // delay processing by 1 second so that the second card's image is visible.
      if (!isSinglePlayer && isPlayerTurn && flipped.length === 2) {
        setTimeout(() => {
          // Ensure that the room still has 2 flipped cards before processing.
          if (latestRoomData && latestRoomData.flipped && latestRoomData.flipped.length === 2) {
            processMultiplayerFlips();
          }
        }, 1000);
      }

      // Check win condition.
      if (data.winner && winMessage.style.display !== "block") {
        showWinMessage(data.winner);
      }
    });
  });
});

// Handle image uploads.
uploadInput.addEventListener("change", e => {
  images = Array.from(e.target.files).slice(0, 8);
});

// Render the game board.
function renderBoard(cards, flippedCards = []) {
  gameBoard.innerHTML = "";
  cards.forEach(card => {
    const cardDiv = document.createElement("div");
    cardDiv.className = "card";
    cardDiv.dataset.id = card.id;

    // Display card face if flipped or matched.
    const isFlipped = flippedCards.some(fc => fc.id === card.id) || card.matched;
    if (isFlipped) {
      cardDiv.classList.add("flipped");
      cardDiv.style.backgroundImage = `url(${card.src})`;
    }

    // Card click handler with debug logs.
    cardDiv.addEventListener("click", () => {
      console.log("Card clicked:", card.id, "isPlayerTurn:", isPlayerTurn);
      if (cardDiv.classList.contains("flipped")) {
        console.log("Card already flipped:", card.id);
        return;
      }
      if (!isSinglePlayer && !isPlayerTurn) {
        console.log("Not your turn yet.");
        return;
      }

      cardDiv.classList.add("flipped");
      cardDiv.style.backgroundImage = `url(${card.src})`;
      flipCount++;
      flipDisplay.textContent = flipCount;

      if (isSinglePlayer) {
        handleSinglePlayerFlip(card, cardDiv);
      } else {
        // Use transaction to add this card to the flipped array.
        addFlippedCard(card);
      }
    });

    gameBoard.appendChild(cardDiv);
  });
}

// Single-player flip logic remains unchanged.
function handleSinglePlayerFlip(card, cardDiv) {
  const flippedCards = gameBoard.querySelectorAll(".card.flipped:not(.matched)");
  if (flippedCards.length === 2) {
    const [first, second] = flippedCards;
    const idA = parseInt(first.dataset.id);
    const idB = parseInt(second.dataset.id);
    const cardA = localBoard[idA];
    const cardB = localBoard[idB];
    const isMatch = cardA.src === cardB.src;

    setTimeout(() => {
      if (!isMatch) {
        first.classList.remove("flipped");
        second.classList.remove("flipped");
        first.style.backgroundImage = "";
        second.style.backgroundImage = "";
      } else {
        first.classList.add("matched");
        second.classList.add("matched");
        cardA.matched = true;
        cardB.matched = true;
      }

      if (localBoard.every(c => c.matched)) {
        showWinMessage("You");
      }
    }, 1000);
  }
}

// Process multiplayer flips using a transaction on the entire room.
function processMultiplayerFlips() {
  const roomRef = db.ref(`rooms/${roomId}`);
  roomRef.transaction(room => {
    if (!room) return room;
    const flipped = room.flipped || [];
    // If not exactly two cards are flipped, abort.
    if (flipped.length !== 2) return room;
    const [card1, card2] = flipped;
    const isMatch = card1.src === card2.src;
    if (isMatch) {
      // Update board cards as matched.
      room.board = room.board.map(card => {
        if (card.id === card1.id || card.id === card2.id) {
          return { ...card, matched: true };
        }
        return card;
      });
      room.currentTurn = localPlayer;
    } else {
      room.currentTurn = getOpponent(room);
    }
    // Clear the flipped cards.
    room.flipped = [];
    return room;
  }, (error, committed, snapshot) => {
    if (error) {
      console.error("Transaction failed in processMultiplayerFlips:", error);
    } else if (!committed) {
      console.log("Transaction aborted in processMultiplayerFlips");
    } else {
      console.log("Multiplayer flip processed successfully:", snapshot.val());
    }
  });
}

// Helper: add a flipped card using a transaction on the flipped field.
function addFlippedCard(card) {
  const flippedRef = db.ref(`rooms/${roomId}/flipped`);
  flippedRef.transaction(currentFlips => {
    currentFlips = currentFlips || [];
    // Prevent adding if already two cards or duplicate.
    if (currentFlips.length >= 2 || currentFlips.some(c => c.id === card.id)) {
      console.log("Ignoring duplicate or extra flip for card:", card.id);
      return;
    }
    console.log("Adding card to flipped array:", card.id);
    return [...currentFlips, card];
  }, (error, committed, snapshot) => {
    if (error) {
      console.error("Transaction failed in addFlippedCard:", error);
    } else if (!committed) {
      console.log("Transaction aborted in addFlippedCard");
    } else {
      console.log("Flipped card added successfully:", snapshot.val());
    }
  });
}

// Dynamically derive opponent's name from room data.
function getOpponent(roomData) {
  const playersObj = roomData.players || {};
  const playerNames = Object.keys(playersObj);
  if (playerNames.length < 2) return null;
  return playerNames.find(name => name !== localPlayer) || null;
}

// Show win message and clean up game data after a delay.
function showWinMessage(winner) {
  winMessage.style.display = "block";
  results.textContent = `${winner} wins! 🎉`;
  clearInterval(timerInterval);
  // Cleanup game data after 5 seconds.
  setTimeout(cleanupGame, 5000);
}

// Remove game data from Firebase.
function cleanupGame() {
  if (!roomId) return;
  db.ref(`rooms/${roomId}`).remove()
    .then(() => {
      console.log("Game data cleaned up from Firebase for room:", roomId);
    })
    .catch((error) => {
      console.error("Error cleaning up game data:", error);
    });
}

// Timer function.
function startTimer() {
  clearInterval(timerInterval);
  startTime = Date.now();
  timerInterval = setInterval(() => {
    timerDisplay.textContent = Math.floor((Date.now() - startTime) / 1000);
  }, 1000);
}

// Utility: shuffle an array.
function shuffle(arr) {
  return arr.sort(() => 0.5 - Math.random());
}

// Utility: convert blob to Base64.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Upload image to Imgur.
async function uploadToImgur(base64Data) {
  const formData = new FormData();
  formData.append("image", base64Data.split(',')[1]);
  const res = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
    body: formData
  });
  const data = await res.json();
  if (!data.success) throw new Error("Imgur upload failed");
  return data.data.link;
}

// Generate image via AI from prompt.
async function generateImageFromPrompt(prompt) {
  const HF_TOKEN = "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";
  const res = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: prompt })
  });
  if (!res.ok) throw new Error("HuggingFace error");
  const blob = await res.blob();
  const base64 = await blobToBase64(blob);
  return await uploadToImgur(base64);
}

// Start game event.
startBtn.addEventListener("click", async () => {
  if (!isSinglePlayer && (!roomId || !localPlayer)) {
    return alert("Join a room first or enable Single Player Mode.");
  }

  winMessage.style.display = "none";
  flipCount = 0;
  flipDisplay.textContent = "0";
  timerDisplay.textContent = "0";
  gameBoard.innerHTML = "";

  let imgData = [];

  if (aiToggle.checked) {
    const prompts = document.getElementById("aiPrompts").value
      .split("\n").map(s => s.trim()).filter(Boolean).slice(0, 8);
    loader.style.display = "block";
    for (let i = 0; i < prompts.length; i++) {
      try {
        const url = await generateImageFromPrompt(prompts[i]);
        imgData.push(url);
      } catch {
        console.error("AI generation failed for prompt:", prompts[i]);
      }
      const pct = Math.round(((i + 1) / prompts.length) * 100);
      progressBar.style.width = `${pct}%`;
      loaderProgress.textContent = `${pct}%`;
    }
    loader.style.display = "none";
  } else {
    const imgPromises = images.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const url = await uploadToImgur(reader.result);
          resolve(url);
        } catch {
          resolve(null);
        }
      };
      reader.readAsDataURL(file);
    }));
    imgData = (await Promise.all(imgPromises)).filter(Boolean);
  }

  if (imgData.length < 2) return alert("Need at least 2 images.");

  const allCards = shuffle([...imgData, ...imgData]);
  if (isSinglePlayer) {
    localBoard = allCards.map((src, idx) => ({ src, matched: false, id: idx }));
    renderBoard(localBoard);
  } else {
    db.ref(`rooms/${roomId}`).update({
      board: allCards.map((src, idx) => ({ src, matched: false, id: idx })),
      currentTurn: localPlayer,
      flipped: [],
      winner: null
    });
  }

  startTimer();
});