// 🔥 Firebase config
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
let images = [];
let localPlayer = null;
let roomId = null;
let isPlayerTurn = false;
let flipCount = 0;
let timerInterval;
let startTime;
let isSinglePlayer = false;
let localBoard = [];

const joinBtn = document.getElementById("joinRoom");
const playerInput = document.getElementById("playerName");
const roomInput = document.getElementById("roomCode");
const joinStatus = document.getElementById("joinStatus");
const playerLabel = document.getElementById("playerLabel");
const turnLabel = document.getElementById("turnLabel");
const gameBoard = document.getElementById("gameBoard");
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

singleToggle.addEventListener("change", () => {
  isSinglePlayer = singleToggle.checked;
  document.getElementById("multiplayerSetup").style.display = isSinglePlayer ? "none" : "block";
  turnLabel.textContent = isSinglePlayer ? "You" : "–";
});

aiToggle.addEventListener("change", () => {
  aiPromptArea.style.display = aiToggle.checked ? "block" : "none";
});

joinBtn.addEventListener("click", () => {
  localPlayer = playerInput.value.trim();
  roomId = roomInput.value.trim().toLowerCase();
  if (!localPlayer || !roomId) {
    joinStatus.textContent = "❌ Enter a name and room code.";
    return;
  }

  const roomRef = db.ref(`rooms/${roomId}`);
  roomRef.once("value").then(snapshot => {
    const roomData = snapshot.val() || {};
    const players = roomData.players || {};
    if (Object.keys(players).length >= 2 && !players[localPlayer]) {
      joinStatus.textContent = "❌ Room full.";
      return;
    }

    roomRef.child("players").child(localPlayer).set({ joinedAt: Date.now() });
    playerLabel.textContent = localPlayer;
    turnLabel.textContent = "Waiting...";
    joinStatus.textContent = "✅ Joined! Waiting for second player...";

    roomRef.on("value", snapshot => {
      const data = snapshot.val();
      if (!data) return;
      isPlayerTurn = data.currentTurn === localPlayer;
      turnLabel.textContent = data.currentTurn || "–";

      if (data.board && Array.isArray(data.board)) renderBoard(data.board);
      if (data.winner && !winMessage.style.display.includes("block")) {
        showWinMessage(data.winner);
      }
    });
  });
});

uploadInput.addEventListener("change", e => {
  images = Array.from(e.target.files).slice(0, 8);
});

startBtn.addEventListener("click", async () => {
  if (!isSinglePlayer && (!roomId || !localPlayer)) {
    return alert("Join a room first or enable Single Player Mode.");
  }

  winMessage.style.display = "none";
  flipDisplay.textContent = "0";
  timerDisplay.textContent = "0";
  flipCount = 0;
  gameBoard.innerHTML = "";

  let imgData = [];

  if (aiToggle.checked) {
    const prompts = document.getElementById("aiPrompts").value
      .split("\n").map(s => s.trim()).filter(Boolean).slice(0, 8);
    if (prompts.length === 0) return alert("Enter prompts.");

    loader.style.display = "block";
    progressBar.style.width = "0%";
    loaderProgress.textContent = "0%";

    for (let i = 0; i < prompts.length; i++) {
      try {
        const imgUrl = await generateImageFromPrompt(prompts[i]);
        imgData.push(imgUrl);
      } catch (err) {
        console.error("❌ AI image failed:", err);
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
          console.log("✅ Uploaded to Imgur:", url);
          resolve(url);
        } catch (err) {
          console.error("❌ Upload failed:", err);
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

function shuffle(arr) {
  return arr.sort(() => 0.5 - Math.random());
}

function startTimer() {
  clearInterval(timerInterval);
  startTime = Date.now();
  timerInterval = setInterval(() => {
    timerDisplay.textContent = Math.floor((Date.now() - startTime) / 1000);
  }, 1000);
}

function showWinMessage(winner) {
  winMessage.style.display = "block";
  results.textContent = `${winner} wins! 🎉`;
}

function getOpponent() {
  return localPlayer === "Aaron" ? "Matthew" : "Aaron";
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function uploadToImgur(base64Data) {
  const formData = new FormData();
  formData.append("image", base64Data.split(',')[1]);

  const res = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: {
      Authorization: `Client-ID ${IMGUR_CLIENT_ID}`
    },
    body: formData
  });

  const data = await res.json();
  if (!data.success) throw new Error("Imgur upload failed");
  return data.data.link;
}

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

function renderBoard(cards) {
  gameBoard.innerHTML = "";

  cards.forEach(card => {
    const div = document.createElement("div");
    div.className = "card";
    div.dataset.id = card.id;

    if (card.matched) {
      div.classList.add("flipped");
      div.style.backgroundImage = `url(${card.src})`;
    }

    div.addEventListener("click", () => {
      if (div.classList.contains("flipped")) return;

      flipCount++;
      flipDisplay.textContent = flipCount;

      div.classList.add("flipped");
      div.style.backgroundImage = `url(${card.src})`;

      if (isSinglePlayer) {
        const flipped = gameBoard.querySelectorAll(".card.flipped:not(.matched)");
        if (flipped.length === 2) {
          const [a, b] = flipped;
          const idA = parseInt(a.dataset.id);
          const idB = parseInt(b.dataset.id);
          const cardA = localBoard[idA];
          const cardB = localBoard[idB];
          const isMatch = cardA.src === cardB.src;

          setTimeout(() => {
            if (!isMatch) {
              a.classList.remove("flipped");
              a.style.backgroundImage = "";
              b.classList.remove("flipped");
              b.style.backgroundImage = "";
            } else {
              a.classList.add("matched");
              b.classList.add("matched");
              cardA.matched = true;
              cardB.matched = true;
            }

            if (localBoard.every(c => c.matched)) {
              showWinMessage("You");
            }
          }, 1000);
        }
      } else {
        db.ref(`rooms/${roomId}/flipped`).once("value").then(snapshot => {
          const flipped = snapshot.val() || [];
          if (flipped.find(c => c.id === card.id)) return;

          flipped.push(card);

          if (flipped.length === 2) {
            const [a, b] = flipped;
            const isMatch = a.src === b.src;

            setTimeout(() => {
              const updates = {};
              updates[`rooms/${roomId}/flipped`] = [];

              if (isMatch) {
                cards[a.id].matched = true;
                cards[b.id].matched = true;
                updates[`rooms/${roomId}/board`] = cards;
              } else {
                const aDiv = document.querySelector(`.card[data-id="${a.id}"]`);
                const bDiv = document.querySelector(`.card[data-id="${b.id}"]`);
                aDiv.classList.remove("flipped");
                bDiv.classList.remove("flipped");
                aDiv.style.backgroundImage = "";
                bDiv.style.backgroundImage = "";
              }

              updates[`rooms/${roomId}/currentTurn`] = isMatch ? localPlayer : getOpponent();
              if (cards.every(c => c.matched)) {
                updates[`rooms/${roomId}/winner`] = localPlayer;
              }

              db.ref().update(updates);
            }, 1000);
          } else {
            db.ref(`rooms/${roomId}/flipped`).set(flipped);
          }
        });
      }
    });

    gameBoard.appendChild(div);
  });
}