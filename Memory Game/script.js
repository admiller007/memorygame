const uploadInput = document.getElementById('imageUpload');
const startBtn = document.getElementById('startGame');
const gameBoard = document.getElementById('gameBoard');

let images = [];

uploadInput.addEventListener('change', (e) => {
  images = Array.from(e.target.files).slice(0, 8); // limit to 8 pairs = 16 cards
});

startBtn.addEventListener('click', () => {
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

  Promise.all(readerPromises).then(imgData => {
    startMemoryGame(imgData);
  });
});

function startMemoryGame(imgData) {
  gameBoard.innerHTML = '';
  let cards = [...imgData, ...imgData]; // duplicate for pairs
  cards = shuffle(cards);

  const gridSize = Math.ceil(Math.sqrt(cards.length));
  gameBoard.style.gridTemplateColumns = `repeat(${gridSize}, 100px)`;

  let firstCard = null;
  let lockBoard = false;

  cards.forEach((src, index) => {
    const card = document.createElement('div');
    card.className = 'card';

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const front = document.createElement('div');
    front.className = 'card-front';
    front.style.backgroundColor = '#888';

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

      if (!firstCard) {
        firstCard = card;
      } else {
        const secondCard = card;
        const isMatch = firstCard.querySelector('.card-back').style.backgroundImage ===
                        secondCard.querySelector('.card-back').style.backgroundImage;

        if (isMatch) {
          firstCard = null;
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

function shuffle(array) {
  return array.sort(() => 0.5 - Math.random());
}