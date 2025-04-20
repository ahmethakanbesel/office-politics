package main

import (
	"encoding/json"
	"log"
	"os"
)

func (g *Game) loadCards(filename string) error {
	// Read the file
	data, err := os.ReadFile(filename)
	if err != nil {
		log.Printf("Failed to read cards file: %v", err)
		// Fall back to sample cards if the file can't be read
		g.loadSampleCards()
		return err
	}

	// Parse JSON
	var loadedCards []*Card
	err = json.Unmarshal(data, &loadedCards)
	if err != nil {
		log.Printf("Failed to parse cards JSON: %v", err)
		// Fall back to sample cards if JSON parsing fails
		g.loadSampleCards()
		return err
	}

	if len(loadedCards) == 0 {
		log.Print("Card file contained no valid cards, using sample cards")
		g.loadSampleCards()
		return nil
	}

	// Set cards and initialize available cards
	g.cards = loadedCards
	g.resetAvailableCards()

	return nil
}

// Fallback function to load sample cards if JSON loading fails
func (g *Game) loadSampleCards() {
	sampleCards := []*Card{
		{
			ID:         "WELCOME",
			Text:       "Hazırsanız başlayalım",
			IsInfoOnly: true,
			MaxUses:    1,
		},
		{
			ID:         "OVERTIME_REQUEST",
			Text:       "Patronunuz bugün fazla mesai yapmanızı istiyor. Kabul edecek misiniz?",
			YesText:    "Evet",
			NoText:     "Hayır",
			YesEffects: Effects{Performance: 10, Motivation: -5, Boss: 10},
			NoEffects:  Effects{Performance: -5, Motivation: 5, Boss: -10},
			MaxUses:    3,
		},
		{
			ID:         "COFFEE_BREAK",
			Text:       "İş arkadaşınız kahve molası vermek istiyor. Katılacak mısınız?",
			YesText:    "Evet",
			NoText:     "Hayır",
			YesEffects: Effects{Colleagues: 10, Motivation: 5, Performance: -5},
			NoEffects:  Effects{Colleagues: -5, Motivation: -5, Performance: 5},
			MaxUses:    3,
		},
		// Add a few more sample cards
	}

	g.cards = sampleCards
	g.resetAvailableCards()
}

func (g *Game) resetAvailableCards() {
	g.availableCards = make([]*Card, len(g.cards))
	copy(g.availableCards, g.cards)

	// Reset uses count
	for _, card := range g.cards {
		card.Uses = 0
	}
}
