package main

import (
	"image/color"
	"log"
	"math"
	"time"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/inpututil"
)

// Game represents the game state
type Game struct {
	state          int
	resources      Resources
	cards          []*Card
	availableCards []*Card
	currentCard    *Card
	delayedCards   []FollowupCardItem
	playedCardIDs  []string
	gameOver       bool
	winCardShown   bool
	gameOverReason string

	// Card animation
	dragging           bool
	startX, currentX   float64
	cardX, cardY       float64
	cardRotation       float64
	cardOpacity        float64
	cardTargetX        float64
	cardTargetRotation float64
	cardTargetOpacity  float64
	animating          bool

	// Stack animation
	stackItems [2]struct {
		X, Y    float64
		Opacity float64
	}

	// UI elements
	restartButton Button
	aboutButton   Button
}

func NewGame() *Game {
	g := &Game{
		state: stateGame,
		resources: Resources{
			Motivation:  40,
			Performance: 40,
			Colleagues:  40,
			Boss:        40,
			Day:         1,
		},
		cardX:        0,
		cardY:        0,
		cardOpacity:  1.0,
		cardRotation: 0,

		// Setup stack items
		stackItems: [2]struct {
			X, Y    float64
			Opacity float64
		}{
			{X: 8, Y: 4, Opacity: 0.8},
			{X: 4, Y: 2, Opacity: 0.9},
		},

		// Setup buttons
		restartButton: Button{
			X:          screenWidth/2 - 80,
			Y:          screenHeight/2 + 50,
			Width:      160,
			Height:     50,
			Text:       "Yeniden Başla",
			Color:      colorRestartBtn,
			HoverColor: color.RGBA{29, 78, 216, 255},
			TextColor:  colorTextLight,
		},
		aboutButton: Button{
			X:          screenWidth - 45,
			Y:          15,
			Width:      30,
			Height:     30,
			Text:       "i",
			Color:      colorCardBorder,
			HoverColor: color.RGBA{75, 85, 101, 255},
			TextColor:  colorTextLight,
		},
	}

	// Load cards
	if err := g.loadCards("assets/deck.json"); err != nil {
		log.Printf("Failed to load cards: %v", err)
		g.showWelcomeCard() // Show welcome card even if deck fails to load
	} else {
		g.showWelcomeCard()
	}

	return g
}

func (g *Game) showWelcomeCard() {
	welcomeCard := &Card{
		ID:         "WELCOME",
		Text:       "Hazırsanız başlayalım",
		IsInfoOnly: true,
		Effects:    Effects{},
		MaxUses:    1,
	}

	g.currentCard = welcomeCard
	g.cardX = 0
	g.cardY = 0
	g.cardOpacity = 1.0
	g.cardRotation = 0
}

func (g *Game) getNextCard() *Card {
	// Check if there are no available cards, reshuffle
	if len(g.availableCards) == 0 {
		g.resetAvailableCards()
		g.winCardShown = false
	}

	// Check for win condition card
	if g.resources.Day >= 70 &&
		g.resources.Motivation >= 70 &&
		g.resources.Performance >= 70 &&
		g.resources.Colleagues >= 70 &&
		g.resources.Boss >= 70 &&
		!g.winCardShown {

		// Find the competitor job offer card
		for i, card := range g.availableCards {
			if card.ID == "COMPETITOR_JOB_OFFER" && card.Uses < card.MaxUses {
				g.winCardShown = true
				selectedCard := card
				// Remove from available pool
				g.availableCards = append(g.availableCards[:i], g.availableCards[i+1:]...)
				selectedCard.Uses++
				return selectedCard
			}
		}
	}

	// Check delayed cards first
	for i, delayedCard := range g.delayedCards {
		if delayedCard.ShowOnDay <= g.resources.Day {
			if g.checkRequirements(delayedCard.Card.Requirements) {
				if delayedCard.Card.Uses < delayedCard.Card.MaxUses {
					// Remove from delayed cards
					g.delayedCards = append(g.delayedCards[:i], g.delayedCards[i+1:]...)
					delayedCard.Card.Uses++
					return delayedCard.Card
				}
			}
		}
	}

	// Filter cards
	var validCards []*Card
	for _, card := range g.availableCards {
		// Check uses
		if card.Uses >= card.MaxUses {
			continue
		}

		// Check requirements
		if !g.checkRequirements(card.Requirements) {
			continue
		}

		// Card is valid
		validCards = append(validCards, card)
	}

	// No valid cards
	if len(validCards) == 0 {
		// Try reshuffling
		g.resetAvailableCards()

		// Refilter
		for _, card := range g.availableCards {
			if card.Uses < card.MaxUses && g.checkRequirements(card.Requirements) {
				validCards = append(validCards, card)
			}
		}

		// Still no valid cards
		if len(validCards) == 0 {
			return nil
		}
	}

	// Select a random card from valid cards
	randomIndex := random.Intn(len(validCards))
	selectedCard := validCards[randomIndex]

	// Remove from available cards
	for i, card := range g.availableCards {
		if card == selectedCard {
			g.availableCards = append(g.availableCards[:i], g.availableCards[i+1:]...)
			break
		}
	}

	// Increment uses
	selectedCard.Uses++
	return selectedCard
}

func (g *Game) checkRequirements(req *Requirement) bool {
	// No requirements
	if req == nil {
		return true
	}

	// Compound requirements (AND/OR)
	if req.Type != "" && len(req.Conditions) > 0 {
		switch req.Type {
		case "and":
			// All conditions must be true
			for _, condition := range req.Conditions {
				if !g.checkRequirements(&condition) {
					return false
				}
			}
			return true
		case "or":
			// At least one condition must be true
			for _, condition := range req.Conditions {
				if g.checkRequirements(&condition) {
					return true
				}
			}
			return false
		}
	}

	// Simple requirement
	if req.Resource != "" && req.Comparison != "" {
		var resourceValue int

		// Get resource value
		switch req.Resource {
		case "motivation":
			resourceValue = g.resources.Motivation
		case "performance":
			resourceValue = g.resources.Performance
		case "colleagues":
			resourceValue = g.resources.Colleagues
		case "boss":
			resourceValue = g.resources.Boss
		case "day":
			resourceValue = g.resources.Day
		default:
			return false
		}

		// Compare
		switch req.Comparison {
		case "gt":
			return resourceValue > req.Value
		case "lt":
			return resourceValue < req.Value
		case "gte":
			return resourceValue >= req.Value
		case "lte":
			return resourceValue <= req.Value
		case "eq":
			return resourceValue == req.Value
		}
	}

	return false
}

func (g *Game) updateResources(effects Effects) {
	// Apply effects with scaling
	motivationChange := float64(effects.Motivation) * 0.5
	performanceChange := float64(effects.Performance) * 0.5
	colleaguesChange := float64(effects.Colleagues) * 0.35
	bossChange := float64(effects.Boss) * 0.5

	// Update resources with clamping
	g.resources.Motivation = clamp(g.resources.Motivation+int(motivationChange), minValue, maxValue)
	g.resources.Performance = clamp(g.resources.Performance+int(performanceChange), minValue, maxValue)
	g.resources.Colleagues = clamp(g.resources.Colleagues+int(colleaguesChange), minValue, maxValue)
	g.resources.Boss = clamp(g.resources.Boss+int(bossChange), minValue, maxValue)

	g.resources.Day++

	// Check for game over conditions
	g.checkGameOver()
}

func (g *Game) checkGameOver() bool {
	if g.gameOver {
		return true
	}

	if g.resources.Motivation <= minValue ||
		g.resources.Performance <= minValue ||
		g.resources.Colleagues <= minValue ||
		g.resources.Boss <= minValue ||
		g.resources.Motivation >= maxValue ||
		g.resources.Performance >= maxValue ||
		g.resources.Colleagues >= maxValue ||
		g.resources.Boss >= maxValue {

		g.gameOver = true
		g.state = stateGameOver

		// Set game over reason
		if g.resources.Motivation <= minValue {
			g.gameOverReason = "Motivasyonunuz tükendi. İşi bıraktınız."
		} else if g.resources.Motivation >= maxValue {
			g.gameOverReason = "Aşırı motivasyon sizi tüketti. Burnout oldunuz."
		} else if g.resources.Performance <= minValue {
			g.gameOverReason = "Performansınız çok düşük. Kovuldunuz."
		} else if g.resources.Performance >= maxValue {
			g.gameOverReason = "Çok fazla çalıştınız. Tükenmişlik sendromu yaşadınız."
		} else if g.resources.Colleagues <= minValue {
			g.gameOverReason = "İş arkadaşlarınız sizden nefret ediyor. Yalnız kaldınız ve istifa ettiniz."
		} else if g.resources.Colleagues >= maxValue {
			g.gameOverReason = "İş arkadaşlarınızla çok yakınsınız. Bu aranızdaki sosyalliğin artmasına ve iş yerine sosyal kulüp muamelesi yapmanıza sebep oldu. Kovuldunuz."
		} else if g.resources.Boss <= minValue {
			g.gameOverReason = "Patronunuz sizi sevmiyor. Kovuldunuz."
		} else if g.resources.Boss >= maxValue {
			g.gameOverReason = "Patronunuz sizi çok seviyor. Terfi ettiniz ve oyunu kazandınız!"
		}

		return true
	}
	return false
}

func (g *Game) processCard(isYes bool) {
	// Handle welcome card
	if g.currentCard == nil || g.gameOver {
		return
	}

	// Record card ID
	if g.currentCard.ID != "" {
		g.playedCardIDs = append(g.playedCardIDs, g.currentCard.ID)
	}

	// Define the win message for the competitor offer scenario
	const competitorWinMessage = "Rakip firmadan gelen teklifi kabul ettiniz ve yeni bir başlangıç yaptınız. Oyunu kazandınız!"

	// Special case for competitor job offer
	if g.currentCard.ID == "COMPETITOR_JOB_OFFER" && isYes {
		g.gameOver = true
		g.state = stateGameOver
		g.gameOverReason = competitorWinMessage
		return
	}

	// Apply effects
	if g.currentCard.IsInfoOnly {
		// Apply info card effects
		g.updateResources(g.currentCard.Effects)
	} else {
		// Apply choice effects
		if isYes {
			g.updateResources(g.currentCard.YesEffects)
		} else {
			g.updateResources(g.currentCard.NoEffects)
		}
	}

	// If game is not over, get next card
	if !g.gameOver {
		nextCard := g.getNextCard()
		g.currentCard = nextCard
		g.cardX = 0
		g.cardY = 0
		g.cardOpacity = 1.0
		g.cardRotation = 0
	}
}

// Animation functions
func (g *Game) animateCardAway(isYes bool) {
	g.animating = true
	direction := 1.0
	if !isYes {
		direction = -1.0
	}

	g.cardTargetX = direction * float64(screenWidth/1.5)
	g.cardTargetRotation = direction * 30
	g.cardTargetOpacity = 0

	// After animation completes, process the card
	time.AfterFunc(500*time.Millisecond, func() {
		g.processCard(isYes)
		g.animating = false

		// Reset card position for next card
		g.cardX = 0
		g.cardY = 0
		g.cardRotation = 0
		g.cardOpacity = 1.0
	})
}

func (g *Game) restartGame() {
	g.resources = Resources{
		Motivation:  50,
		Performance: 50,
		Colleagues:  50,
		Boss:        50,
		Day:         1,
	}

	g.resetAvailableCards()
	g.delayedCards = nil
	g.playedCardIDs = nil
	g.gameOver = false
	g.winCardShown = false
	g.state = stateGame

	g.showWelcomeCard()
}

// Button interaction
func (g *Game) checkButtonHover(x, y int) {
	// Check restart button hover
	if g.state == stateGameOver {
		g.restartButton.IsHovered = float64(x) >= g.restartButton.X &&
			float64(x) <= g.restartButton.X+g.restartButton.Width &&
			float64(y) >= g.restartButton.Y &&
			float64(y) <= g.restartButton.Y+g.restartButton.Height
	}

	// Check about button hover
	g.aboutButton.IsHovered = float64(x) >= g.aboutButton.X &&
		float64(x) <= g.aboutButton.X+g.aboutButton.Width &&
		float64(y) >= g.aboutButton.Y &&
		float64(y) <= g.aboutButton.Y+g.aboutButton.Height
}

func (g *Game) Update() error {
	// Get mouse position
	mx, my := ebiten.CursorPosition()
	g.checkButtonHover(mx, my)

	// Check button clicks
	if inpututil.IsMouseButtonJustPressed(ebiten.MouseButtonLeft) {
		// About button
		if g.aboutButton.IsHovered {
			if g.state != stateAbout {
				g.state = stateAbout
			} else {
				if g.gameOver {
					g.state = stateGameOver
				} else {
					g.state = stateGame
				}
			}
			return nil
		}

		// Close about modal by clicking anywhere if it's open
		if g.state == stateAbout {
			if g.gameOver {
				g.state = stateGameOver
			} else {
				g.state = stateGame
			}
			return nil
		}

		// Restart button
		if g.state == stateGameOver && g.restartButton.IsHovered {
			g.restartGame()
			return nil
		}
	}

	// Handle card dragging
	if g.state == stateGame && !g.gameOver && !g.animating {
		if inpututil.IsMouseButtonJustPressed(ebiten.MouseButtonLeft) {
			// Get card bounds (centered in the screen)
			cardWidth := 400.0
			cardHeight := 500.0
			cardX := (screenWidth - cardWidth) / 2
			cardY := (screenHeight - cardHeight) / 2

			// Check if click is on the card
			if float64(mx) >= cardX && float64(mx) <= cardX+cardWidth &&
				float64(my) >= cardY && float64(my) <= cardY+cardHeight {
				g.dragging = true
				g.startX = float64(mx)
			}
		}

		if g.dragging {
			if ebiten.IsMouseButtonPressed(ebiten.MouseButtonLeft) {
				deltaX := float64(mx) - g.startX
				g.currentX = deltaX

				// Update card position and rotation
				g.cardX = deltaX
				maxRotation := 15.0
				g.cardRotation = math.Min(math.Max(deltaX/10, -maxRotation), maxRotation)
			} else {
				// Mouse released, check if swipe threshold reached
				g.dragging = false
				if math.Abs(g.currentX) > swipeThreshold {
					isYes := g.currentX > 0
					g.animateCardAway(isYes)
				} else {
					// Return to center
					g.cardX = 0
					g.cardY = 0
					g.cardRotation = 0
				}
				g.currentX = 0
			}
		}
	}

	// Handle card animation
	if g.animating {
		// Animate card moving away
		animSpeed := 0.1
		g.cardX += (g.cardTargetX - g.cardX) * animSpeed
		g.cardRotation += (g.cardTargetRotation - g.cardRotation) * animSpeed
		g.cardOpacity += (g.cardTargetOpacity - g.cardOpacity) * animSpeed
	}

	return nil
}

func (g *Game) Draw(screen *ebiten.Image) {
	// Fill background
	screen.Fill(colorBackground)

	switch g.state {
	case stateGame:
		g.drawGameScreen(screen)
	case stateGameOver:
		g.drawGameScreen(screen)
		g.drawGameOverScreen(screen)
	case stateAbout:
		g.drawGameScreen(screen)
		g.drawAboutScreen(screen)
	}
}

func (g *Game) Layout(outsideWidth, outsideHeight int) (int, int) {
	return screenWidth, screenHeight
}
