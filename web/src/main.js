// web/src/main.js
const resources = {
  motivation: 40,
  performance: 40,
  colleagues: 40,
  boss: 40,
  day: 1,
  maxValue: 100,
  minValue: 0,
};

let cards = [];
let availableCards = [];

let currentCard = null;
let delayedCards = [];
let dragging = false;
let startX = 0;
let currentX = 0;
let gameOver = false;
let winCardShown = false;
let personalBest = 0;

// Sound related variables
let isSoundEnabled = true; // Default to sound on
const swipeSound = new Audio('swipe.mp3'); // Create Audio object

// DOM elements
const cardElement = document.getElementById('card');
const cardTextElement = document.getElementById('card-text');
const yesOptionElement = document.getElementById('yes-option');
const noOptionElement = document.getElementById('no-option');
const swipeIndicatorElement = document.getElementById('swipe-indicator');
const dayCounterElement = document.getElementById('day-counter');
// Stat Fill Elements
const motivationFillElement = document.querySelector(
  '#motivation-icon .stat-fill'
);
const performanceFillElement = document.querySelector(
  '#performance-icon .stat-fill'
);
const colleaguesFillElement = document.querySelector(
  '#colleagues-icon .stat-fill'
);
const bossFillElement = document.querySelector('#boss-icon .stat-fill');
// Stat Icon Elements (for indicators)
const motivationIconElement = document.getElementById('motivation-icon');
const performanceIconElement = document.getElementById('performance-icon');
const colleaguesIconElement = document.getElementById('colleagues-icon');
const bossIconElement = document.getElementById('boss-icon');
// Other elements
const aboutIconElement = document.getElementById('about-icon');
const aboutModalElement = document.getElementById('about-modal');
const gameOverElement = document.getElementById('game-over');
const gameOverReasonElement = document.getElementById('game-over-reason');
const restartButtonElement = document.getElementById('restart-button');
const soundToggleButtonElement = document.getElementById('sound-toggle-button'); // Get sound button

// --- Sound Functions ---
function playSwipeSound() {
  if (isSoundEnabled) {
    // Reset playback time to allow rapid playing if needed
    swipeSound.currentTime = 0;
    swipeSound
      .play()
      .catch((error) => console.error('Error playing swipe sound:', error));
  }
}

function updateSoundButtonUI() {
  soundToggleButtonElement.textContent = isSoundEnabled ? '🔊' : '🔇';
}

function toggleSound() {
  isSoundEnabled = !isSoundEnabled;
  updateSoundButtonUI();
  // Save preference to localStorage
  localStorage.setItem('officePoliticsSoundEnabled', isSoundEnabled.toString());
  // Play a sound when toggling on (optional feedback)
  if (isSoundEnabled) {
    playSwipeSound();
  }
}

function loadSoundPreference() {
  const savedPreference = localStorage.getItem('officePoliticsSoundEnabled');
  if (savedPreference !== null) {
    isSoundEnabled = savedPreference === 'true';
  } else {
    isSoundEnabled = true; // Default to true if nothing saved
  }
  updateSoundButtonUI();
}

// --- Load Cards and Initialize Game ---
function initializeGame() {
  loadPersonalBest();
  loadSoundPreference(); // Load sound preference

  // First show the welcome card
  showWelcomeCard();

  // Initialize the stack with two cards
  const cardArea = document.getElementById('card-area');

  // Remove any existing stack items (in case of restart)
  document
    .querySelectorAll('.card-stack-item')
    .forEach((item) => item.remove());

  // Create two stack items with no initial animation
  for (let i = 0; i < 2; i++) {
    const stackItem = document.createElement('div');
    stackItem.className = 'card-stack-item';
    stackItem.style.transition = 'none'; // No transition for initial setup

    // Apply appropriate styling based on position
    if (i === 0) {
      // First stack item (middle position)
      stackItem.style.transform = 'translate(4px, 2px)';
      stackItem.style.opacity = '0.9';
      stackItem.style.zIndex = '3';
    } else {
      // Second stack item (back position)
      stackItem.style.transform = 'translate(8px, 4px)';
      stackItem.style.opacity = '0.8';
      stackItem.style.zIndex = '2';
    }

    // Insert at the beginning of card-area
    cardArea.insertBefore(stackItem, cardArea.firstChild);
  }

  // Then load the cards normally
  fetch('deck.json?v=' + Date.now()) // Fetch the JSON file
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json(); // Parse JSON response
    })
    .then((loadedCards) => {
      console.log('Cards loaded successfully.');
      cards = loadedCards; // Assign loaded cards to the global variable

      cards.forEach((card) => {
        if (card.maxUses === undefined) {
          card.maxUses = 1;
        }
        // Note: Followup cards defined inline will have their default set
        // when they are processed by queueFollowupCard.
      });

      // --- Initialize game state that depends on cards ---
      availableCards = [...cards]; // Populate available cards
      cards.forEach((card) => {
        // Ensure uses count is reset
        card.uses = 0;
      });
      delayedCards = []; // Reset delayed cards
      gameOver = false; // Reset game over state

      // Note: We don't set currentCard here as we're showing the welcome card
      // The welcome card will be replaced with the first game card when the player swipes
    })
    .catch((error) => {
      console.error('Error loading or parsing cards.json:', error);
      cardTextElement.textContent = 'Kartlar yüklenirken hata oluştu.';
      // Disable game or show error state
      gameOver = true;
    });
}

/**
 * Checks if the card's requirements are met by the current resources.
 * @param {object | undefined} cardRequirements - The requirements object from the card.
 * @param {object} currentResources - The current game resources state.
 * @returns {boolean} - True if requirements are met or no requirements exist, false otherwise.
 */
function checkRequirements(cardRequirements, currentResources) {
  // If no requirements field, or it's null/empty, requirements are met.
  if (!cardRequirements || Object.keys(cardRequirements).length === 0) {
    return true;
  }

  // Handle logical grouping (AND/OR)
  if (
    cardRequirements.type &&
    cardRequirements.conditions &&
    Array.isArray(cardRequirements.conditions)
  ) {
    if (cardRequirements.type.toLowerCase() === 'and') {
      // For AND, ALL conditions must be true
      return cardRequirements.conditions.every((condition) =>
        checkRequirements(condition, currentResources)
      );
    } else if (cardRequirements.type.toLowerCase() === 'or') {
      // For OR, AT LEAST ONE condition must be true
      return cardRequirements.conditions.some((condition) =>
        checkRequirements(condition, currentResources)
      );
    } else {
      console.warn('Invalid requirement type:', cardRequirements.type);
      return false; // Invalid type, fail the check
    }
  }

  // Handle single condition
  if (
    cardRequirements.resource &&
    cardRequirements.comparison &&
    typeof cardRequirements.value !== 'undefined'
  ) {
    const resourceName = cardRequirements.resource;
    const comparison = cardRequirements.comparison.toLowerCase();
    const requiredValue = cardRequirements.value;
    const currentValue = currentResources[resourceName];

    if (typeof currentValue === 'undefined') {
      console.warn(
        `Requirement check failed: Resource "${resourceName}" not found.`
      );
      return false; // Resource doesn't exist in game state
    }

    switch (comparison) {
      case 'gt': // Greater than
        return currentValue > requiredValue;
      case 'lt': // Less than
        return currentValue < requiredValue;
      case 'gte': // Greater than or equal to
        return currentValue >= requiredValue;
      case 'lte': // Less than or equal to
        return currentValue <= requiredValue;
      case 'eq': // Equal to
        return currentValue === requiredValue;
      default:
        console.warn('Invalid comparison operator:', comparison);
        return false; // Invalid comparison, fail the check
    }
  }

  // If the structure is invalid (neither group nor single condition)
  console.warn('Invalid requirement structure:', cardRequirements);
  return false;
}

function getNextCard() {
  // Check if cards array is populated
  if (!cards || cards.length === 0) {
    console.error(
      "Attempted to get next card, but 'cards' array is empty or not loaded."
    );
    return null;
  }

  const winChanceCardId = 'COMPETITOR_JOB_OFFER';
  const meetWinConditions =
    resources.day >= 70 &&
    resources.motivation >= 50 &&
    resources.performance >= 50 &&
    resources.colleagues >= 50 &&
    resources.boss >= 50 &&
    !winCardShown;

  if (meetWinConditions) {
    const winChanceCard = cards.find((card) => card.id === winChanceCardId);
    if (winChanceCard) {
      // Check if this card hasn't been used yet (maxUses is now guaranteed to exist)
      if ((winChanceCard.uses || 0) < winChanceCard.maxUses) {
        // Simplified check
        console.log('Win conditions met, presenting WIN_CHANCE_CARD.');
        // Increment uses *before* returning to prevent re-selection if declined
        winChanceCard.uses = (winChanceCard.uses || 0) + 1;

        // Remove from availableCards pool for this cycle if it's there
        const cardIndexInAvailable = availableCards.indexOf(winChanceCard);
        if (cardIndexInAvailable > -1) {
          availableCards.splice(cardIndexInAvailable, 1);
        }

        winCardShown = true; // Mark that the win card has been shown
        return winChanceCard; // Return the specific win chance card
      } else {
        console.log('Win conditions met, but WIN_CHANCE_CARD already used.');
        // Proceed with normal card selection if the win card was already shown/used
      }
    } else {
      console.error(
        `Card with id '${winChanceCardId}' not found in deck.json!`
      );
      // Proceed with normal card selection as a fallback
    }
  }

  // Oynanmış kart ID'lerini takip etmek için global değişken oluştur
  if (!window.playedCardIds) {
    window.playedCardIds = [];
  }

  // Track if the previous card was an info card
  const previousCardWasInfo = currentCard && currentCard.isInfoOnly;

  // 1. Check delayed cards first
  if (delayedCards.length > 0) {
    // Önce ebeveyn kartı gösterilmiş olan takip kartlarını ara
    const readyFollowupIndex = delayedCards.findIndex(
      (item) =>
        item.showOnDay <= resources.day &&
        item.parentCardId &&
        window.playedCardIds.includes(item.parentCardId)
    );

    if (readyFollowupIndex !== -1) {
      const readyFollowup = delayedCards[readyFollowupIndex];
      // Takip kartına maxUses varsayılan değerini ata (Handled by queueFollowupCard)
      // if (readyFollowup.card.parentCardId && readyFollowup.card.maxUses === undefined) {
      //   readyFollowup.card.maxUses = 1;
      // }

      if (checkRequirements(readyFollowup.card.requirements, resources)) {
        // Check maxUses for delayed card before returning
        if ((readyFollowup.card.uses || 0) < readyFollowup.card.maxUses) {
          delayedCards.splice(readyFollowupIndex, 1);
          // Increment uses for delayed cards as well
          if (!readyFollowup.card.uses) readyFollowup.card.uses = 0;
          readyFollowup.card.uses++;
          return readyFollowup.card;
        } else {
          // console.log(`Delayed card ${readyFollowup.card.id} maxUses reached, skipping.`);
          // Optionally remove it if it shouldn't be checked again
          // delayedCards.splice(readyFollowupIndex, 1);
        }
      }
    }

    // If previous card was info, find the first non-info delayed card that's ready
    if (previousCardWasInfo) {
      const readyNonInfoCardIndex = delayedCards.findIndex(
        (item) =>
          item.showOnDay <= resources.day &&
          !item.card.isInfoOnly &&
          (!item.parentCardId ||
            window.playedCardIds.includes(item.parentCardId))
      );

      if (readyNonInfoCardIndex !== -1) {
        const readyCard = delayedCards[readyNonInfoCardIndex];
        // Takip kartına maxUses varsayılan değerini ata (Handled by queueFollowupCard)
        // if (readyCard.card.parentCardId && readyCard.card.maxUses === undefined) {
        //   readyCard.card.maxUses = 1;
        // }

        // Check requirements for delayed cards too
        if (checkRequirements(readyCard.card.requirements, resources)) {
          // Check maxUses for delayed card before returning
          if ((readyCard.card.uses || 0) < readyCard.card.maxUses) {
            delayedCards.splice(readyNonInfoCardIndex, 1);
            // Increment uses for delayed cards as well
            if (!readyCard.card.uses) readyCard.card.uses = 0;
            readyCard.card.uses++;
            return readyCard.card;
          } else {
            // console.log(`Delayed card ${readyCard.card.id} maxUses reached, skipping.`);
            // delayedCards.splice(readyNonInfoCardIndex, 1);
          }
        }
      }
      // If no non-info delayed cards are ready, we'll proceed to pick from regular deck
    } else {
      // Regular delayed card check - önce takip kartları olanları kontrol et
      const readyCardIndex = delayedCards.findIndex(
        (item) =>
          item.showOnDay <= resources.day &&
          (!item.parentCardId ||
            window.playedCardIds.includes(item.parentCardId))
      );

      if (readyCardIndex !== -1) {
        const readyCard = delayedCards[readyCardIndex];
        // Takip kartına maxUses varsayılan değerini ata (Handled by queueFollowupCard)
        // if (readyCard.card.parentCardId && readyCard.card.maxUses === undefined) {
        //   readyCard.card.maxUses = 1;
        // }

        if (checkRequirements(readyCard.card.requirements, resources)) {
          // Check maxUses for delayed card before returning
          if ((readyCard.card.uses || 0) < readyCard.card.maxUses) {
            delayedCards.splice(readyCardIndex, 1);
            if (!readyCard.card.uses) readyCard.card.uses = 0;
            readyCard.card.uses++;
            return readyCard.card;
          } else {
            // console.log(`Delayed card ${readyCard.card.id} maxUses reached, skipping.`);
            // delayedCards.splice(readyCardIndex, 1);
          }
        }
      }
    }
  }

  // 2. Prepare the pool of potential cards
  let potentialCards = [...availableCards]; // Start with cards not yet used in this cycle

  // If the pool is empty, reshuffle *all* cards
  if (potentialCards.length === 0) {
    console.log(
      'No available cards left in this cycle, reshuffling all cards...'
    );
    cards.forEach((card) => (card.uses = 0)); // Reset uses count on reshuffle
    availableCards = [...cards]; // Reset availableCards pool
    potentialCards = [...availableCards]; // Use the fresh pool
    winCardShown = false; // Reset win card shown flag on reshuffle
  }

  // 3. REMOVED: Default maxUses setting here is redundant
  // potentialCards.forEach(card => {
  //   if (card.parentCardId && card.maxUses === undefined) {
  //     card.maxUses = 1;
  //   }
  // });

  // 4. Filter the potential cards
  let validCards = potentialCards.filter((card) => {
    // Filter 1: Max Uses (maxUses is guaranteed to exist now)
    const maxUsesOk = (card.uses || 0) < card.maxUses;
    if (!maxUsesOk) return false;

    // Filter 2: Requirements
    const requirementsOk = checkRequirements(card.requirements, resources);
    if (!requirementsOk) return false;

    // Filter 3: Prevent consecutive info cards
    if (previousCardWasInfo && card.isInfoOnly) return false;

    // Filter 4: Takip kartı ise ebeveyn kartının oynanmış olması gerekir
    if (card.parentCardId && !window.playedCardIds.includes(card.parentCardId))
      return false;

    return true;
  });

  // 5. Handle case where filtering results in no valid cards
  if (validCards.length === 0) {
    console.log(
      'No cards meet requirements/maxUses from current pool. Trying full reshuffle and re-filter...'
    );

    // Reshuffle *all* cards again (reset uses) and reset available pool
    cards.forEach((card) => (card.uses = 0));
    availableCards = [...cards];
    potentialCards = [...availableCards]; // Use the fresh pool
    winCardShown = false; // Reset win card shown flag on reshuffle

    // REMOVED: Default maxUses setting here is redundant
    // potentialCards.forEach(card => {
    //   if (card.parentCardId && card.maxUses === undefined) {
    //     card.maxUses = 1;
    //   }
    // });

    // Re-apply filters, but if we're still getting no cards, relax the info card constraint
    validCards = potentialCards.filter((card) => {
      // Max Uses check
      const maxUsesOk = (card.uses || 0) < card.maxUses;
      if (!maxUsesOk) return false;

      // Requirements check
      const requirementsOk = checkRequirements(card.requirements, resources);
      if (!requirementsOk) return false;

      // Parent card check
      if (
        card.parentCardId &&
        !window.playedCardIds.includes(card.parentCardId)
      )
        return false;

      // Only apply info card prevention if we have other options
      if (previousCardWasInfo && card.isInfoOnly) {
        // Count how many non-info cards we have that meet other requirements
        const nonInfoOptions = potentialCards.filter(
          (c) =>
            (c.uses || 0) < c.maxUses &&
            checkRequirements(c.requirements, resources) &&
            !c.isInfoOnly &&
            (!c.parentCardId || window.playedCardIds.includes(c.parentCardId))
        ).length;

        // If we have non-info options, exclude this info card
        if (nonInfoOptions > 0) return false;
        // If we have NO other options, allow consecutive info cards as a fallback
      }

      return true;
    });

    // If still no cards after full reshuffle and re-filter, return null
    if (validCards.length === 0) {
      console.warn(
        'No cards available that meet requirements even after full reshuffle.'
      );
      return null; // Indicate no card is available right now
    }
  }

  // 6. Prioritize non-info cards if the previous was info
  if (previousCardWasInfo && validCards.length > 0) {
    // Try to find non-info cards first
    const nonInfoCards = validCards.filter((card) => !card.isInfoOnly);

    // If we have non-info cards, select from those instead
    if (nonInfoCards.length > 0) {
      validCards = nonInfoCards;
    }
    // Otherwise, we'll reluctantly use an info card if that's all we have
  }

  // 7. Öncelik olarak takip kartlarını seç (if available after other filters)
  const followupCards = validCards.filter(
    (card) =>
      card.parentCardId && window.playedCardIds.includes(card.parentCardId)
  );
  if (followupCards.length > 0) {
    // Check if there are non-followup options available too
    const nonFollowupCards = validCards.filter(
      (card) =>
        !card.parentCardId || !window.playedCardIds.includes(card.parentCardId)
    );
    // If there are ONLY followup cards, use them. If there's a mix, maybe prioritize followups?
    // Current logic: If any followups are valid, pick ONLY from them.
    validCards = followupCards;
  }

  // 8. Select a random card from the valid list
  const randomIndex = Math.floor(Math.random() * validCards.length);
  const selectedCard = validCards[randomIndex];

  // 9. Remove the selected card from the main available list for this cycle
  const cardIndexInAvailable = availableCards.indexOf(selectedCard);
  if (cardIndexInAvailable > -1) {
    availableCards.splice(cardIndexInAvailable, 1);
  }

  // 10. Increment uses count for the selected card
  if (!selectedCard.uses) selectedCard.uses = 0;
  selectedCard.uses++;

  return selectedCard;
}

function updateCardUI(card) {
  if (!card) {
    // Handle the case where getNextCard returned null
    cardTextElement.textContent = 'Bugün sakin geçiyor...'; // Or another appropriate message
    console.log(
      'updateCardUI called with null card - no available card meets requirements.'
    );
    cardElement.classList.add('info-only'); // Style as info card maybe
    yesOptionElement.style.display = 'none';
    noOptionElement.style.display = 'none';
    swipeIndicatorElement.style.display = 'block'; // Show swipe indicator to proceed
    // Ensure card is visually reset but maybe slightly dimmed or styled differently
    cardElement.style.transition = 'none';
    cardElement.style.transform = 'rotate(0) translateX(0)';
    cardElement.style.opacity = '0.8'; // Example: slightly faded
    cardElement.style.background = 'rgb(229, 231, 235)'; // Example: greyish background
    return;
  }
  cardTextElement.textContent = card.text;

  if (card.isInfoOnly) {
    // Bilgilendirme kartı
    cardElement.classList.add('info-only');
    yesOptionElement.style.display = 'none';
    noOptionElement.style.display = 'none';
    swipeIndicatorElement.style.display = 'block';
  } else {
    // Normal karar kartı
    cardElement.classList.remove('info-only');
    yesOptionElement.style.display = 'block';
    noOptionElement.style.display = 'block';
    swipeIndicatorElement.style.display = 'none';

    yesOptionElement.textContent = card.yesText || 'Evet';
    noOptionElement.textContent = card.noText || 'Hayır';
  }
  // Reset card position and style for the new card
  cardElement.style.transition = 'none'; // Prevent animation on new card load
  cardElement.style.transform = 'rotate(0) translateX(0)';
  cardElement.style.opacity = '1';
  cardElement.style.background = card.isInfoOnly
    ? 'rgb(249, 250, 251)'
    : 'white';
  yesOptionElement.style.opacity = '1'; // Reset opacity
  noOptionElement.style.opacity = '1'; // Reset opacity
}

// --- Stat Change Indicator ---
/**
 * Shows a temporary visual indicator on a stat icon.
 * @param {string} statName - The name of the stat ('motivation', 'performance', etc.).
 * @param {number} changeAmount - The amount the stat changed (positive for increase, negative for decrease).
 */
function showStatChangeIndicator(statName, changeAmount) {
  let iconElement;
  switch (statName) {
    case 'motivation':
      iconElement = motivationIconElement;
      break;
    case 'performance':
      iconElement = performanceIconElement;
      break;
    case 'colleagues':
      iconElement = colleaguesIconElement;
      break;
    case 'boss':
      iconElement = bossIconElement;
      break;
    default:
      return; // Unknown stat
  }

  if (!iconElement) return; // Element not found

  // Remove any existing indicator classes first
  iconElement.classList.remove('stat-increase', 'stat-decrease');

  // Add the appropriate class based on the change
  if (changeAmount > 0) {
    iconElement.classList.add('stat-increase');
  } else if (changeAmount < 0) {
    iconElement.classList.add('stat-decrease');
  } else {
    return; // No change, no indicator needed
  }

  // Set a timeout to remove the indicator class after a short duration
  setTimeout(() => {
    iconElement.classList.remove('stat-increase', 'stat-decrease');
  }, 750); // Duration of the indicator flash in milliseconds
}

// Kaynakları güncelleme fonksiyonu (Dictionary based)
function updateResources(effects) {
  if (!effects) return; // No effects to apply

  // Store old values to calculate change
  const oldMotivation = resources.motivation;
  const oldPerformance = resources.performance;
  const oldColleagues = resources.colleagues;
  const oldBoss = resources.boss;

  // Get change amounts or 0 if not specified in effects
  const motivationChange =
    effects.motivation * (Math.random() * 0.15 + 0.5) || 0;
  const performanceChange =
    effects.performance * (Math.random() * 0.15 + 0.5) || 0;
  const colleaguesChange =
    effects.colleagues * (Math.random() * 0.15 + 0.35) || 0;
  const bossChange = effects.boss * (Math.random() * 0.15 + 0.5) || 0;

  // Update resources, clamping between minValue and maxValue
  resources.motivation = Math.max(
    Math.min(resources.motivation + motivationChange, resources.maxValue),
    resources.minValue
  );
  resources.performance = Math.max(
    Math.min(resources.performance + performanceChange, resources.maxValue),
    resources.minValue
  );
  resources.colleagues = Math.max(
    Math.min(resources.colleagues + colleaguesChange, resources.maxValue),
    resources.minValue
  );
  resources.boss = Math.max(
    Math.min(resources.boss + bossChange, resources.maxValue),
    resources.minValue
  );

  resources.day++; // Increment day after applying effects

  // Arayüzü güncelle (Update fill levels)
  updateUI();

  // Show indicators based on the *actual* change after clamping
  showStatChangeIndicator('motivation', resources.motivation - oldMotivation);
  showStatChangeIndicator(
    'performance',
    resources.performance - oldPerformance
  );
  showStatChangeIndicator('colleagues', resources.colleagues - oldColleagues);
  showStatChangeIndicator('boss', resources.boss - oldBoss);

  // Oyun sonu kontrolü
  checkGameOver(); // Check game over after updating resources
}

// Bilgilendirme kartı etkilerini uygula (Uses updateResources now)
function applyInfoCardEffects(effects) {
  // Info cards also use the same resource update logic
  // updateResources handles UI update, indicators, and game over check
  updateResources(effects);
  // Note: Day is incremented inside updateResources, no need to increment again here
}

// Arayüzü güncelleme fonksiyonu (Updates fill levels and day counter)
function updateUI() {
  dayCounterElement.textContent = `Gün ${resources.day}`;

  // Stat ikon fill seviyelerini güncelle
  motivationFillElement.style.height = `${resources.motivation}%`;
  performanceFillElement.style.height = `${resources.performance}%`;
  colleaguesFillElement.style.height = `${resources.colleagues}%`;
  bossFillElement.style.height = `${resources.boss}%`;
}

function checkGameOver() {
  if (gameOver) return true;

  if (
    resources.motivation <= resources.minValue ||
    resources.performance <= resources.minValue ||
    resources.colleagues <= resources.minValue ||
    resources.boss <= resources.minValue ||
    resources.motivation >= resources.maxValue ||
    resources.performance >= resources.maxValue ||
    resources.colleagues >= resources.maxValue ||
    resources.boss >= resources.maxValue
  ) {
    gameOver = true;
    showGameOver();
    return true;
  }
  return false;
}

function showWelcomeCard() {
  const welcomeCard = {
    text: 'Hazırsanız başlayalım',
    isInfoOnly: true,
    effects: {}, // No effects for welcome card
  };

  currentCard = welcomeCard;
  updateCardUI(welcomeCard);
}

function loadPersonalBest() {
  const savedBest = localStorage.getItem('officePoliticsPersonalBest');
  if (savedBest) {
    personalBest = parseInt(savedBest, 10);
  } else {
    personalBest = 0;
  }

  // Update the best score display in the info/about screen
  updateInfoScreenBestScore();
}

// Add a new function to update the best score in the info screen
function updateInfoScreenBestScore() {
  const bestScoreElement = document.getElementById('info-best-score');
  if (bestScoreElement) {
    if (personalBest > 0) {
      bestScoreElement.textContent = `En uzun oyununuz ${personalBest} gün sürdü.`;
      bestScoreElement.style.display = 'block';
    } else {
      bestScoreElement.style.display = 'none'; // Hide if no best score yet
    }
  }
}

function savePersonalBest(days) {
  if (days > personalBest) {
    personalBest = days;
    localStorage.setItem('officePoliticsPersonalBest', personalBest.toString());
    // Update the info screen best score display
    updateInfoScreenBestScore();
    return true; // Return true if this is a new personal best
  }
  return false; // Return false if not a new personal best
}

function showGameOver(winReason = null) {
  let reason = '';
  let isWin = false;

  if (winReason) {
    // If a specific win reason is provided, use it
    reason = winReason;
    isWin = true;
  } else {
    const lossReasons = {
      motivationLow: [
        'Motivasyonunuz tükendi. İşi bıraktınız.',
        'Her sabah işe gitmek dayanılmaz bir hal aldı. Motivasyonsuzluktan istifa ettiniz.',
        'İşe karşı tüm heyecanınızı kaybettiniz ve motivasyonunuz dibe vurdu. İstifa etmeye karar verdiniz.',
        'Projelerinize olan ilginizi tamamen kaybettiniz. Motivasyon eksikliğinden dolayı işten ayrıldınız.',
      ],
      motivationHigh: [
        'Aşırı motivasyon sizi tüketti. Burnout oldunuz.',
        'Aşırı motivasyon, sizi gece gündüz çalışmaya itti ve sonunda tükendiniz.',
        'Çok hevesli olmanız dengeli bir yaşam sürmenizi engelledi. Aşırı motivasyon burnout yaşamanıza sebep oldu.',
        'Motivasyonunuzu kontrol edemeyip kendinizi tükettiniz. İşkoliklik sizi bitirdi.',
      ],
      performanceLow: [
        'Performansınız çok düşük. Kovuldunuz.',
        'Üst üste başarısız projeler nedeniyle performansınız kabul edilemez seviyeye düştü. İşten çıkarıldınız.',
        'Hedeflerinizi tutturamadınız ve düşük performans nedeniyle şirket sizi kadroda tutamadı.',
        'Verimlilik raporlarınız sürekli düşüş gösterdi ve sonunda performans yetersizliğinden işinize son verildi.',
      ],
      performanceHigh: [
        'Çok fazla çalıştınız. Tükenmişlik sendromu yaşadınız.',
        'Sürekli yüksek performans göstermeniz sizi fiziksel ve zihinsel olarak tüketti.',
        'Mükemmeliyetçiliğiniz sizi aşırı çalışmaya sürükledi ve sonunda tükenmişlik yaşadınız.',
        'Performansınızın sınırlarını zorlamanız sağlığınızı bozdu ve işi bırakmak zorunda kaldınız.',
      ],
      colleaguesLow: [
        'İş arkadaşlarınız sizden nefret ediyor. Yalnız kaldınız ve istifa ettiniz.',
        'Ekip çalışmasında yaşadığınız sorunlar ciddi iletişim kopukluklarına yol açtı. Yalnızlaştınız ve istifa ettiniz.',
        'Meslektaşlarınızla sürekli çatışmalar yaşadığınız için ofisteki atmosfer dayanılmaz hale geldi. İstifa etmeyi seçtiniz.',
        'İş arkadaşlarınızla kuramadığınız olumlu ilişkiler, size karşı bir cephe oluşmasına neden oldu. Yalnızlık dayanılmaz hale gelince istifa ettiniz.',
      ],
      colleaguesHigh: [
        'İş arkadaşlarınızla çok yakınsınız. Bu aranızdaki sosyalliğin artmasına ve iş yerine sosyal kulüp muamelesi yapmanıza sebep oldu. Kovuldunuz.',
        'Ofisteki aşırı sosyalleşmeniz iş verimliliğinizi düşürdü. Şirket, sosyal ilişkilerinizin iş performansınızı etkilediğini düşünerek sizi işten çıkardı.',
        'İş arkadaşlarınızla kurduğunuz yakın ilişkiler mesai saatlerinde gevezeliğe ve işlerin aksamasına yol açtı. Şirket bu duruma son vermek için sizi işten çıkardı.',
        'Çalışma ortamını aşırı sosyalleştirmeniz şirket politikalarına aykırı bulundu ve profesyonellikten uzaklaştığınız gerekçesiyle işinize son verildi.',
      ],
      bossLow: [
        'Patronunuz sizi sevmiyor. Kovuldunuz.',
        'Yöneticinizle yaşadığınız sürekli anlaşmazlıklar sonucu işten çıkarıldınız.',
        'Patronunuzla aranızdaki uyumsuzluk sonunda onun sabrını taşırdı ve işinize son verildi.',
        'Yöneticinizle kurduğunuz olumsuz ilişki, şirket içindeki geleceğinizi baltaladı ve sonunda kovuldunuz.',
      ],
      bossHigh: [
        'Patronunuzla kurduğunuz aşırı yakın ilişki, ofis içinde dedikodulara ve çalışma arkadaşlarınızın size karşı güvenini kaybetmesine yol açtı. Diğer çalışanlar kayırıldığınızı düşünmeye başladı ve takım dinamikleri bozuldu. Patronunuz, şirket kültürünü korumak ve diğer çalışanların moralini düzeltmek için, size olan kişisel sempatisine rağmen, pozisyonunuzu sonlandırmak zorunda kaldı.',
        "Yöneticinizle olan yakınlığınız, diğer çalışanlar arasında adaletsizlik algısı yarattı. Bu durum ofis politikasını olumsuz etkiledi ve sonunda yöneticiniz 'çıkar çatışması' gerekçesiyle sizi işten çıkarmak zorunda kaldı.",
        'Patronunuzla kurduğunuz samimi ilişki, şirket içi hiyerarşiyi bozdu ve diğer yöneticilerin otoritesini zayıflattı. Şirket politikası gereği pozisyonunuz sonlandırıldı.',
        'Yöneticinizle fazla yakınlaşmanız, profesyonel sınırları aşmanıza ve şirket içi dengelerin bozulmasına yol açtı. İş ortamındaki bu olumsuz etki nedeniyle işten çıkarıldınız.',
      ],
    };

    if (resources.motivation <= resources.minValue) {
      const randomIndex = Math.floor(
        Math.random() * lossReasons.motivationLow.length
      );
      reason = lossReasons.motivationLow[randomIndex];
    } else if (resources.motivation >= resources.maxValue) {
      const randomIndex = Math.floor(
        Math.random() * lossReasons.motivationHigh.length
      );
      reason = lossReasons.motivationHigh[randomIndex];
    } else if (resources.performance <= resources.minValue) {
      const randomIndex = Math.floor(
        Math.random() * lossReasons.performanceLow.length
      );
      reason = lossReasons.performanceLow[randomIndex];
    } else if (resources.performance >= resources.maxValue) {
      const randomIndex = Math.floor(
        Math.random() * lossReasons.performanceHigh.length
      );
      reason = lossReasons.performanceHigh[randomIndex];
    } else if (resources.colleagues <= resources.minValue) {
      const randomIndex = Math.floor(
        Math.random() * lossReasons.colleaguesLow.length
      );
      reason = lossReasons.colleaguesLow[randomIndex];
    } else if (resources.colleagues >= resources.maxValue) {
      const randomIndex = Math.floor(
        Math.random() * lossReasons.colleaguesHigh.length
      );
      reason = lossReasons.colleaguesHigh[randomIndex];
    } else if (resources.boss <= resources.minValue) {
      const randomIndex = Math.floor(
        Math.random() * lossReasons.bossLow.length
      );
      reason = lossReasons.bossLow[randomIndex];
    } else if (resources.boss >= resources.maxValue) {
      const randomIndex = Math.floor(
        Math.random() * lossReasons.bossHigh.length
      );
      reason = lossReasons.bossHigh[randomIndex];
    } else {
      // Fallback if somehow called without a specific reason or boundary hit
      reason = 'Oyun sona erdi.';
    }
  }

  // Add the days lasted text to the reason
  // Calculate days (subtract 1 since the game ends on the current day)
  const daysSurvived = resources.day - 1;

  // Check if this is a new personal best
  const isNewPersonalBest = savePersonalBest(daysSurvived);

  // Create appropriate message based on win/loss and personal best
  let daysMessage = '';

  if (isWin) {
    daysMessage = `${daysSurvived} günde kariyerinizde yeni bir dönüm noktasına ulaştınız.`;
  } else {
    daysMessage = `${daysSurvived} gün dayanabildiniz.`;
  }

  // Add personal best message
  let personalBestMessage = '';
  if (isNewPersonalBest && daysSurvived > 0) {
    personalBestMessage = `<span class="personal-best-highlight">İyi iş! Bu oyun bu zamana kadar ki en uzun oyununuz oldu.</span>`;
  } else if (personalBest > 0) {
    personalBestMessage = `En uzun oyununuz ${personalBest} gün sürmüştü.`;
  }

  // Update game over text with reason, days message, and personal best
  gameOverReasonElement.innerHTML = `${reason}<br><br>${daysMessage}`;

  // Create or update the personal best element
  let personalBestElement = document.getElementById('personal-best');
  if (!personalBestElement) {
    personalBestElement = document.createElement('div');
    personalBestElement.id = 'personal-best';
    // Insert before the restart button
    gameOverElement.insertBefore(personalBestElement, restartButtonElement);
  }

  personalBestElement.innerHTML = personalBestMessage;

  // Show the game over screen
  gameOverElement.style.display = 'flex';
  gameOver = true; // IMPORTANT: Ensure the gameOver flag is set here too
}

function queueFollowupCard(followupCards, delay, parentCardId) {
  if (!followupCards) return;

  let cardsToQueue = [];

  // Handle single followup card object (backward compatibility or specific case)
  if (!Array.isArray(followupCards)) {
    // Takip kartına ebeveyn kart ID'sini ekle
    followupCards.parentCardId = parentCardId;
    // Takip kartlarına varsayılan maxUses=1 atanıyor
    if (followupCards.maxUses === undefined) {
      followupCards.maxUses = 1;
    }
    cardsToQueue.push(followupCards);
  } else {
    // Handle array of followups with probabilities
    const totalProbability = followupCards.reduce(
      (sum, card) => sum + (card.probability || 0),
      0
    );
    let selected = false;

    // If probabilities are defined and sum > 0, use them
    if (totalProbability > 0) {
      const random = Math.random() * totalProbability;
      let cumulativeProbability = 0;
      for (const card of followupCards) {
        cumulativeProbability += card.probability || 0;
        if (random <= cumulativeProbability) {
          // Takip kartına ebeveyn kart ID'sini ekle
          card.parentCardId = parentCardId;
          // Takip kartlarına varsayılan maxUses=1 atanıyor
          if (card.maxUses === undefined) {
            card.maxUses = 1;
          }
          cardsToQueue.push(card);
          selected = true;
          break;
        }
      }
    }

    // If no probabilities defined, total is 0, or random selection failed, select one randomly
    if (!selected && followupCards.length > 0) {
      const randomIndex = Math.floor(Math.random() * followupCards.length);
      const selectedCard = followupCards[randomIndex];
      // Takip kartına ebeveyn kart ID'sini ekle
      selectedCard.parentCardId = parentCardId;
      // Takip kartlarına varsayılan maxUses=1 atanıyor
      if (selectedCard.maxUses === undefined) {
        selectedCard.maxUses = 1;
      }
      cardsToQueue.push(selectedCard);
    }
  }

  // Add the selected card(s) to the delayed queue or immediate queue
  cardsToQueue.forEach((card) => {
    // Check for nested followup (like the zam request)
    if (card.followup) {
      // Queue the nested followup to appear after this card
      // Use nested delay if available, otherwise use parent's delay or default
      const nestedDelay = card.followup.delay || card.delay || delay || 1;
      queueFollowupCard(card.followup, nestedDelay, card.id || parentCardId);
    } else if (card.followups) {
      // Handle nested array followups
      const nestedDelay = card.delay || delay || 1; // Use current card's delay if available
      queueFollowupCard(card.followups, nestedDelay, card.id || parentCardId);
    }

    // Get the actual delay value
    const actualDelay =
      card.delay !== undefined ? card.delay : delay !== undefined ? delay : 1;

    if (actualDelay === 0) {
      // If delay is 0, set this card as the next card to show immediately
      // Store it for use in the processCard function
      if (!window.immediateFollowups) window.immediateFollowups = [];
      window.immediateFollowups.push(card);
    } else {
      // Queue the current card with a delay
      const showOnDay = resources.day + actualDelay;
      delayedCards.push({
        card: card,
        showOnDay: showOnDay,
        parentCardId: card.parentCardId, // Ebeveyn kart ID'sini saklayın
      });
    }
  });

  // Sort delayed cards by show day
  delayedCards.sort((a, b) => a.showOnDay - b.showOnDay);
}

function restartGame() {
  console.log('Restarting game...');
  // Reset resources
  resources.motivation = 50;
  resources.performance = 50;
  resources.colleagues = 50;
  resources.boss = 50;
  resources.day = 1;

  // Re-initialize card-dependent state
  if (cards && cards.length > 0) {
    availableCards = [...cards];
    cards.forEach((card) => {
      card.uses = 0; // Reset uses count
    });
    delayedCards = []; // Clear delayed cards
    gameOver = false; // Reset game over flag
    winCardShown = false; // Reset win card flag
    window.playedCardIds = []; // Reset played cards
    window.immediateFollowups = null; // Reset immediate followups

    // Show welcome card again instead of getting next card
    showWelcomeCard();
  } else {
    // Handle error case if cards failed to load initially
    cardTextElement.textContent =
      'Hata: Kartlar yüklenemediği için yeniden başlatılamıyor.';
    console.error('Cannot restart, cards array is empty or not loaded.');
    gameOver = true;
  }

  updateUI(); // Update resource display
  gameOverElement.style.display = 'none'; // Hide game over screen

  // Reset card visual state explicitly
  cardElement.style.transition = 'none';
  cardElement.style.transform = 'rotate(0) translateX(0)';
  cardElement.style.opacity = '1';
  // Background reset happens in updateCardUI

  // Reset stat icon indicators
  [
    motivationIconElement,
    performanceIconElement,
    colleaguesIconElement,
    bossIconElement,
  ].forEach((icon) => {
    icon.classList.remove('stat-increase', 'stat-decrease');
  });

  // Reinitialize the stack
  // Remove any existing stack items
  document
    .querySelectorAll('.card-stack-item')
    .forEach((item) => item.remove());

  // Create two fresh stack items
  const cardArea = document.getElementById('card-area');
  for (let i = 0; i < 2; i++) {
    const stackItem = document.createElement('div');
    stackItem.className = 'card-stack-item';
    stackItem.style.transition = 'none'; // No transition for initial setup

    // Apply appropriate styling based on position
    if (i === 0) {
      // First stack item (middle position)
      stackItem.style.transform = 'translate(4px, 2px)';
      stackItem.style.opacity = '0.9';
      stackItem.style.zIndex = '3';
    } else {
      // Second stack item (back position)
      stackItem.style.transform = 'translate(8px, 4px)';
      stackItem.style.opacity = '0.8';
      stackItem.style.zIndex = '2';
    }

    // Insert at the beginning of card-area
    cardArea.insertBefore(stackItem, cardArea.firstChild);
  }
}

function addNewCardToStack() {
  const cardArea = document.getElementById('card-area');
  const stackItems = document.querySelectorAll('.card-stack-item');

  // If we already have the maximum number of stack items (2), remove the last one
  if (stackItems.length >= 2) {
    stackItems[stackItems.length - 1].remove();
  }

  // Create a new stack item to go at the back
  const newStackItem = document.createElement('div');
  newStackItem.className = 'card-stack-item';

  // Initial position - off screen to the right and transparent
  newStackItem.style.transform = 'translate(20px, 4px)';
  newStackItem.style.opacity = '0';
  newStackItem.style.zIndex = '2';

  // Insert the new stack item at the beginning of card-area (before all other elements)
  cardArea.insertBefore(newStackItem, cardArea.firstChild);

  // Force a reflow to ensure the starting position is applied
  void newStackItem.offsetWidth;

  // Add transition for smooth animation
  newStackItem.style.transition = 'all 0.5s ease';

  // After a tiny delay, animate to the final position (right to left)
  setTimeout(() => {
    newStackItem.style.transform = 'translate(8px, 4px)';
    newStackItem.style.opacity = '0.8';
  }, 50);

  // Reapply styles to main card to ensure it stays on top
  cardElement.style.zIndex = '10';
}

function animateStackForward() {
  const stackItems = document.querySelectorAll('.card-stack-item');

  // Enable transitions on stack items
  stackItems.forEach((item) => {
    item.style.transition = 'all 0.5s ease';
  });

  // Move the first stack item to the main card position
  if (stackItems.length > 0) {
    stackItems[0].style.transform = 'translate(0, 0)';
    stackItems[0].style.opacity = '1';
    stackItems[0].style.zIndex = '5'; // Higher than other stack items
  }

  // Move the second stack item to the first stack position
  if (stackItems.length > 1) {
    stackItems[1].style.transform = 'translate(4px, 2px)';
    stackItems[1].style.opacity = '0.9';
    stackItems[1].style.zIndex = '3';
  }
}

// Assuming showGameOver, updateResources, queueFollowupCard, applyInfoCardEffects,
// checkGameOver, getNextCard, updateCardUI, cardElement, gameOverElement,
// gameOverReasonElement, resources, currentCard, delayedCards, gameOver,
// window.playedCardIds, window.immediateFollowups, etc. are defined elsewhere
// as in your original main.js

function processCard(isYes) {
  // Handle welcome card separately if needed (assuming it's handled before calling this)
  // if (currentCard && currentCard.id === 'WELCOME') { ... }

  // Don't process if card is null or game is already over
  if (!currentCard || gameOver) {
    console.log('ProcessCard called with null card or game over state.');
    // If card is null (calm day), still need to advance day and check game over
    if (!currentCard && !gameOver) {
      // Simulate advancing a day with no effects
      updateResources({}); // Pass empty effects object
      // Get the next card after the "calm day"
      const nextCard = getNextCard();
      currentCard = nextCard;
      updateCardUI(currentCard);
    }
    return;
  }

  // Store card details before potential changes during processing
  const cardIdBeforeProcessing = currentCard.id;
  const wasInfoCard = currentCard.isInfoOnly;
  const cardToProcess = currentCard; // Keep a reference to the card being processed

  // Define the win message for the competitor offer scenario
  const competitorWinMessage =
    'Rakip firmadan gelen teklifi kabul ettiniz ve yeni bir başlangıç yaptınız. Oyunu kazandınız!';

  // --- Inner function to handle logic after swipe animation ---
  const processAfterSwipe = () => {
    // Use the stored ID for checks, as currentCard might change
    const currentCardId = cardIdBeforeProcessing;

    // --- Check for Competitor Win Condition (Scenario B: Reject Counteroffer) ---
    let competitorWinTriggered = false;
    if (currentCardId === 'COUNTEROFFER' && isYes) {
      // Player chose "Yine de rakip firmaya geçeceksiniz" on the COUNTEROFFER card
      showGameOver(competitorWinMessage); // Trigger custom win
      competitorWinTriggered = true;
      // Game is won, stop further processing for this turn
      return;
    }
    // --- End Competitor Win Check (Scenario B) ---

    // If the game didn't end with the competitor win, proceed with normal logic
    if (!competitorWinTriggered) {
      // --- Apply Effects and Queue Followups ---
      if (wasInfoCard) {
        // Apply effects for info-only cards using the stored card reference
        applyInfoCardEffects(cardToProcess.effects); // applyInfoCardEffects now calls updateResources
        // Queue followups for info-only cards
        if (cardToProcess.followup) {
          queueFollowupCard(
            cardToProcess.followup,
            cardToProcess.followup.delay,
            currentCardId
          );
        } else if (cardToProcess.followups) {
          queueFollowupCard(cardToProcess.followups, null, currentCardId);
        }
      } else {
        // Apply effects and queue followups for decision cards
        if (isYes) {
          updateResources(cardToProcess.yesEffects); // Update resources first

          // --- Check for Competitor Win Condition (Scenario A: Direct Leave) ---
          if (currentCardId === 'COMPETITOR_JOB_OFFER') {
            // Queue the 'yes' followups for the competitor offer
            if (cardToProcess.yesFollowup) {
              queueFollowupCard(
                cardToProcess.yesFollowup,
                cardToProcess.yesFollowup.delay,
                currentCardId
              );
            } else if (cardToProcess.yesFollowups) {
              queueFollowupCard(
                cardToProcess.yesFollowups,
                null,
                currentCardId
              );
            }

            // Check if COUNTEROFFER was NOT queued immediately (delay 0)
            // This implies the player is leaving directly (either COUNTEROFFER has delay > 0,
            // wasn't chosen by probability, or GRASS_NOT_GREENER was chosen instead)
            const counterOfferQueuedImmediately =
              window.immediateFollowups &&
              window.immediateFollowups.some((f) => f.id === 'COUNTEROFFER');

            if (!counterOfferQueuedImmediately) {
              // Trigger custom win because they accepted the offer and aren't getting an immediate counteroffer
              showGameOver(competitorWinMessage);
              competitorWinTriggered = true;
              return; // Exit early, game is won
            }
            // If counter offer *was* queued immediately, the game continues to that card.
          } else {
            // If it wasn't the competitor offer card, queue 'yes' followups normally
            if (cardToProcess.yesFollowup) {
              queueFollowupCard(
                cardToProcess.yesFollowup,
                cardToProcess.yesFollowup.delay,
                currentCardId
              );
            } else if (cardToProcess.yesFollowups) {
              queueFollowupCard(
                cardToProcess.yesFollowups,
                null,
                currentCardId
              );
            }
          }
        } else {
          // Player chose 'no'
          updateResources(cardToProcess.noEffects);
          // Queue 'no' followups
          if (cardToProcess.noFollowup) {
            queueFollowupCard(
              cardToProcess.noFollowup,
              cardToProcess.noFollowup.delay,
              currentCardId
            );
          } else if (cardToProcess.noFollowups) {
            queueFollowupCard(cardToProcess.noFollowups, null, currentCardId);
          }
        }
      } // End of effect/followup logic for decision vs info cards

      // If the game didn't end via competitor win, continue processing
      if (!competitorWinTriggered) {
        // --- Add to Played Cards ---
        if (!window.playedCardIds) {
          window.playedCardIds = [];
        }
        // Only add if it's not an info card that might reappear or if tracking is desired
        // (Adjust this logic based on whether info cards should block future occurrences)
        if (currentCardId) {
          // Add the ID of the card just processed
          window.playedCardIds.push(currentCardId);
        }

        // --- Check Standard Game Over Conditions ---
        // This check happens AFTER resource updates and potential competitor win
        // updateResources already calls checkGameOver, so this might be redundant,
        // but double-checking doesn't hurt.
        if (checkGameOver()) {
          // showGameOver() was called inside checkGameOver() or updateResources
          currentCard = null; // Ensure no new card is processed or UI updated
          return; // Exit, game ended by resource limits
        }

        // --- Get Next Card ---
        let nextCardToShow = null;

        // 1. Check for Immediate Followups first
        if (window.immediateFollowups && window.immediateFollowups.length > 0) {
          let selectedFollowup = null;
          let selectedFollowupIndex = -1;
          // Find the first valid immediate followup (respecting parentCardId if needed)
          for (let i = 0; i < window.immediateFollowups.length; i++) {
            const followup = window.immediateFollowups[i];
            // Ensure parent card was played if specified (important for branching)
            if (
              !followup.parentCardId ||
              (followup.parentCardId &&
                window.playedCardIds.includes(followup.parentCardId))
            ) {
              // Basic requirement check for the followup itself
              if (checkRequirements(followup.requirements, resources)) {
                // Pass resources
                selectedFollowup = followup;
                selectedFollowupIndex = i;
                break;
              }
            }
          }

          if (selectedFollowup) {
            nextCardToShow = selectedFollowup;
            // Remove the selected followup from the immediate queue
            window.immediateFollowups.splice(selectedFollowupIndex, 1);
          }
          // Clean up the global variable if the queue is now empty
          if (
            window.immediateFollowups &&
            window.immediateFollowups.length === 0
          ) {
            window.immediateFollowups = null;
          }
        }

        // 2. If no immediate followup, check for due Delayed Followups
        if (!nextCardToShow) {
          let foundDelayedFollowup = false;
          // Iterate backwards to allow safe removal with splice
          for (let i = delayedCards.length - 1; i >= 0; i--) {
            const delayedItem = delayedCards[i];
            if (delayedItem.showOnDay <= resources.day) {
              // Ensure parent card was played if specified
              if (
                !delayedItem.parentCardId ||
                (delayedItem.parentCardId &&
                  window.playedCardIds.includes(delayedItem.parentCardId))
              ) {
                // Basic requirement check for the delayed card
                if (
                  checkRequirements(delayedItem.card.requirements, resources)
                ) {
                  // Pass resources
                  nextCardToShow = delayedItem.card;
                  delayedCards.splice(i, 1); // Remove from delayed queue
                  foundDelayedFollowup = true;
                  break; // Show only one delayed card per turn if multiple are due
                } else {
                  // Requirement not met, potentially discard or keep checking?
                  // For now, let's assume we just skip it this turn.
                  // console.log(`Delayed card ${delayedItem.card.id} requirements not met.`);
                  // Optionally remove it if it should only be checked once:
                  // delayedCards.splice(i, 1);
                }
              } else {
                // Parent card not played, this delayed card is invalid, remove it.
                // console.log(`Parent card ${delayedItem.parentCardId} not played for delayed card ${delayedItem.card.id}. Removing.`);
                // delayedCards.splice(i, 1);
              }
            }
          }
        }

        // 3. If still no card, get the next card from the general deck logic
        if (!nextCardToShow) {
          nextCardToShow = getNextCard(); // This function handles deck logic, requirements, shuffling etc.
        }

        // --- Update Game State and UI ---
        currentCard = nextCardToShow; // Update the global currentCard

        if (!gameOver) {
          // Double-check game isn't over before UI update
          updateCardUI(currentCard); // Update UI with the new card (or null/calm day message)
        } else {
          // If somehow gameOver became true between checkGameOver and here, ensure UI doesn't update
          updateCardUI(null); // Or handle appropriately
        }
      } // End of check for !competitorWinTriggered (after effects/followups)
    } // End of check for !competitorWinTriggered (before effects/followups)
  }; // --- End of processAfterSwipe function ---

  // --- Trigger Swipe Animation ---
  const direction = isYes ? 1 : -1;
  cardElement.style.transition = 'transform 0.5s ease, opacity 0.5s ease'; // Ensure opacity transition
  cardElement.style.transform = `translateX(${direction * (window.innerWidth / 1.5)}px) rotate(${direction * 30}deg)`; // Adjust distance/rotation as needed
  cardElement.style.opacity = '0';

  // Animate stack and add new card *during* swipe animation
  animateStackForward();
  addNewCardToStack();

  // --- Wait for animation, then process logic ---
  setTimeout(processAfterSwipe, 500); // Match timeout to animation duration
}

// Card dragging logic
cardElement.addEventListener('mousedown', startDrag);
cardElement.addEventListener('touchstart', startDrag, { passive: false }); // Use passive: false if preventDefault is needed
document.addEventListener('mousemove', drag);
document.addEventListener('touchmove', drag, { passive: false }); // Use passive: false if preventDefault is needed
document.addEventListener('mouseup', endDrag);
document.addEventListener('touchend', endDrag);

function startDrag(e) {
  // Allow dragging even if currentCard is null, to trigger the day skip in processCard
  if (gameOver) return;

  dragging = true;
  startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  currentX = 0; // Reset currentX on new drag start
  cardElement.style.transition = 'none'; // Disable transition during drag

  // Prevent default for touch events to avoid scrolling while dragging card
  if (e.type.includes('touch')) {
    e.preventDefault();
  }
}

function drag(e) {
  if (!dragging || gameOver) return; // Don't process drag if not dragging or game over

  const x = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  const deltaX = x - startX;
  currentX = deltaX; // Update currentX

  // Sürükleme sınırlaması
  const maxRotation = 15;
  const rotation = Math.min(Math.max(deltaX / 10, -maxRotation), maxRotation);

  cardElement.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;

  // Only show decision hints and gradient if there's an actual card
  if (currentCard) {
    // Bilgilendirme kartı değilse Evet/Hayır göster/gizle
    if (!currentCard.isInfoOnly) {
      const decisionThreshold = 30; // Show decision text slightly after drag starts
      if (deltaX > decisionThreshold) {
        yesOptionElement.style.opacity = '1';
        noOptionElement.style.opacity = '0.3';
      } else if (deltaX < -decisionThreshold) {
        yesOptionElement.style.opacity = '0.3';
        noOptionElement.style.opacity = '1';
      } else {
        yesOptionElement.style.opacity = '1'; // Show both near center
        noOptionElement.style.opacity = '1';
      }
    }

    // Arka plan renk geçişi (gradient)
    const absX = Math.abs(deltaX);
    const maxGradientOpacity = 0.3; // Limit gradient intensity
    const gradientOpacity = Math.min(absX / 400, maxGradientOpacity); // Calculate opacity based on drag distance

    if (deltaX > 0) {
      // Swiping Right (Yes)
      if (currentCard.isInfoOnly) {
        cardElement.style.background = `linear-gradient(to right, rgb(249, 250, 251), rgba(107, 114, 128, ${gradientOpacity}))`;
      } else {
        cardElement.style.background = `linear-gradient(to right, white, rgba(34, 197, 94, ${gradientOpacity}))`; // Green for Yes
      }
    } else if (deltaX < 0) {
      // Swiping Left (No)
      if (currentCard.isInfoOnly) {
        cardElement.style.background = `linear-gradient(to left, rgb(249, 250, 251), rgba(107, 114, 128, ${gradientOpacity}))`;
      } else {
        cardElement.style.background = `linear-gradient(to left, white, rgba(239, 68, 68, ${gradientOpacity}))`; // Red for No
      }
    } else {
      // Near center
      cardElement.style.background = currentCard.isInfoOnly
        ? 'rgb(249, 250, 251)'
        : 'white';
    }
  } else {
    // If currentCard is null, maybe just keep background neutral
    cardElement.style.background = 'rgb(229, 231, 235)';
  }

  // Prevent default for touch events during drag
  if (e.type.includes('touch')) {
    e.preventDefault();
  }
}

function endDrag(e) {
  if (!dragging || gameOver) return;
  dragging = false;

  const threshold = 50; // kaydırma eşiği

  if (Math.abs(currentX) > threshold) {
    // Karar verildi (or day skip triggered if currentCard is null)
    const isYes = currentX > 0;
    playSwipeSound(); // <<< Play sound on successful swipe
    processCard(isYes); // This will handle animation away and logic
  } else {
    // Kartı orijinal pozisyonuna döndür
    cardElement.style.transition = 'all 0.3s ease'; // Animate back
    cardElement.style.transform = 'rotate(0) translateX(0)';
    // Reset background based on whether there is a card or not
    if (currentCard) {
      cardElement.style.background = currentCard.isInfoOnly
        ? 'rgb(249, 250, 251)'
        : 'white';
      if (!currentCard.isInfoOnly) {
        yesOptionElement.style.opacity = '1'; // Reset opacity
        noOptionElement.style.opacity = '1';
      }
    } else {
      cardElement.style.background = 'rgb(229, 231, 235)'; // Reset to the "null card" background
    }
  }
  // Reset currentX after drag ends
  currentX = 0;
}

// --- Event Listeners ---
aboutIconElement.addEventListener('click', () => {
  updateInfoScreenBestScore();
  aboutModalElement.style.display = 'flex';
});

aboutModalElement.addEventListener('click', () => {
  aboutModalElement.style.display = 'none';
});

restartButtonElement.addEventListener('click', restartGame);

// Add listener for the sound toggle button
soundToggleButtonElement.addEventListener('click', toggleSound);

// --- Initialize ---
initializeGame(); // Load cards and set up initial state
updateUI(); // Initial UI update for resources
