const uploadInput = document.getElementById('imageUpload');
const startBtn = document.getElementById('startGame');
const gameBoard = document.getElementById('gameBoard');
const timerDisplay = document.getElementById('timer');
const flipDisplay = document.getElementById('flipCount');
const winMessage = document.getElementById('winMessage');
const results = document.getElementById('results');

const aiToggle = document.getElementById("aiModeToggle");
const aiPromptArea = document.getElementById("aiPromptArea");

const loader = document.getElementById("loader");
const loaderProgress = document.getElementById("loaderProgress");
const progressBar = document.getElementById("progressBar");

let images = [];
let flipCount = 0;
let matchedPairs = 0;
let timerInterval;
let startTime;
// Create audio element for win sound
const winSound = new Audio('data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Bt8Qjw4BRDV0QMXC47q6s5qgCfZiCJ34BBOBRgQAkBRQiGzbBSIAIQEYLQ6/1eKB5bP/RZFL1zCQRjSCSgvB4zeXWFBYGFC3SfMLGWNB/DbxNtJ3SgXY7PHKJBoR9VuaXCaibxw6NQtA2kSQQvjyhUar9ZRwcHuWQ6s3UXnlQlwt6zqv6Q8T2U0yWJZ6vxMwlp2A7ms3W1Q8F6xcfPvkQ3r3xZVo6c4iV5/XrTzKMqFcYVOqFaWZSNwXhrK0+qoqDhZgeyGFgy5z7DsFE0aSXAXhDkwBg0g3JOz3oLEwNHAunTranOszL2/MQjNBxO+egJgLHAVfE0orCm0/ejWIh3XVBn5rCgwDslQFuIBnEb9IayRBjQ5uC8c8bJNPNYZoSAg8jQKEIKo0Qg2V6gWW5ScXtqOrXt3xfW/UNs1aWOP3SV9HIfQhPAkAAA==');

aiToggle.addEventListener("change", () => {
  aiPromptArea.style.display = aiToggle.checked ? "block" : "none";
});

uploadInput.addEventListener('change', (e) => {
  images = Array.from(e.target.files).slice(0, 8);
});

startBtn.addEventListener('click', async () => {
  gameBoard.innerHTML = '';
  winMessage.style.display = 'none';
  timerDisplay.textContent = '0';
  flipDisplay.textContent = '0';
  flipCount = 0;
  matchedPairs = 0;

  if (aiToggle.checked) {
    const promptLines = document.getElementById('aiPrompts').value
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .slice(0, 8);

    if (promptLines.length === 0) {
      alert("Please enter at least one AI prompt.");
      return;
    }

    const imageUrls = [];
    loader.style.display = "block";
    loaderProgress.textContent = "0%";
    progressBar.style.width = "0%";

    for (let i = 0; i < promptLines.length; i++) {
      const prompt = promptLines[i];
      try {
        const imgUrl = await generateImageFromPrompt(prompt);
        imageUrls.push(imgUrl);
      } catch (err) {
        console.error(`Error generating image for prompt "${prompt}":`, err);
        alert("Failed to generate image for prompt: " + prompt + "\nUsing placeholder instead.");
        imageUrls.push("https://via.placeholder.com/512?text=Image+Unavailable");
      }

      const percent = Math.round(((i + 1) / promptLines.length) * 100);
      loaderProgress.textContent = `${percent}%`;
      progressBar.style.width = `${percent}%`;
    }

    loader.style.display = "none";
    startMemoryGame(imageUrls);
  } else {
    if (images.length === 0) {
      alert('Please upload at least one image.');
      return;
    }

    const readerPromises = images.map(file => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });

    const imgData = await Promise.all(readerPromises);
    startMemoryGame(imgData);
  }
});

function startMemoryGame(imgData) {
  gameBoard.innerHTML = '';

  let cards = [...imgData, ...imgData];
  cards = shuffle(cards);

  const gridSize = Math.ceil(Math.sqrt(cards.length));
  gameBoard.style.gridTemplateColumns = `repeat(${gridSize}, 100px)`;

  let firstCard = null;
  let lockBoard = false;

  startTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    timerDisplay.textContent = seconds;
  }, 1000);

  cards.forEach((src, index) => {
    const card = document.createElement('div');
    card.className = 'card';

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const front = document.createElement('div');
    front.className = 'card-front';
    front.style.background = '#888';

    const back = document.createElement('div');
    back.className = 'card-back';
    back.style.backgroundImage = `url(${src})`;

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    gameBoard.appendChild(card);

    card.addEventListener('click', () => {
      if (lockBoard || card.classList.contains('flipped')) return;

      card.classList.add('flipped');
      flipCount++;
      flipDisplay.textContent = flipCount;

      if (!firstCard) {
        firstCard = card;
      } else {
        const secondCard = card;
        const isMatch = firstCard.querySelector('.card-back').style.backgroundImage ===
                        secondCard.querySelector('.card-back').style.backgroundImage;

        if (isMatch) {
          matchedPairs++;
          firstCard = null;

          if (matchedPairs === imgData.length) {
            clearInterval(timerInterval);
            const totalTime = Math.floor((Date.now() - startTime) / 1000);
            showWinMessage(totalTime, flipCount);
          }
        } else {
          lockBoard = true;
          setTimeout(() => {
            firstCard.classList.remove('flipped');
            secondCard.classList.remove('flipped');
            firstCard = null;
            lockBoard = false;
          }, 1000);
        }
      }
    });
  });
}

function showWinMessage(time, flips) {
  results.textContent = `You finished in ${time} seconds with ${flips} flips. 🧠🔥`;
  winMessage.style.display = 'block';
}

function shuffle(array) {
  return array.sort(() => 0.5 - Math.random());
}