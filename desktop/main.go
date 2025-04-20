package main

import (
	"log"
	"math/rand"
	"os"
	"time"

	"github.com/hajimehoshi/ebiten/v2"
	"golang.org/x/image/font"
	"golang.org/x/image/font/opentype"
)

func main() {
	// Set window size and title
	ebiten.SetWindowSize(screenWidth, screenHeight)
	ebiten.SetWindowTitle("Office Politics")

	// Load font file
	fontData, err := os.ReadFile("assets/font.ttf")
	if err != nil {
		log.Fatalf("Failed to load font: %v", err)
	}

	// Parse the font
	tt, err := opentype.Parse(fontData)
	if err != nil {
		log.Fatalf("Failed to parse font: %v", err)
	}

	scaleFactor := ebiten.Monitor().DeviceScaleFactor()

	// Create font faces
	const dpi = 72
	regularFont, err = opentype.NewFace(tt, &opentype.FaceOptions{
		Size:    16 * scaleFactor,
		DPI:     dpi,
		Hinting: font.HintingFull,
	})
	if err != nil {
		log.Fatalf("Failed to create regular font face: %v", err)
	}

	boldFont, err = opentype.NewFace(tt, &opentype.FaceOptions{
		Size:    20 * scaleFactor,
		DPI:     dpi,
		Hinting: font.HintingFull,
	})
	if err != nil {
		log.Fatalf("Failed to create bold font face: %v", err)
	}

	smallFont, err = opentype.NewFace(tt, &opentype.FaceOptions{
		Size:    12 * scaleFactor,
		DPI:     dpi,
		Hinting: font.HintingFull,
	})
	if err != nil {
		log.Fatalf("Failed to create small font face: %v", err)
	}

	emojiFontData, err := os.ReadFile("assets/font2.ttf")
	if err != nil {
		log.Printf("Failed to load emoji font: %v", err)
		// Fall back to standard font
	} else {
		emojiTT, err := opentype.Parse(emojiFontData)
		if err != nil {
			log.Printf("Failed to parse emoji font: %v", err)
		} else {
			// Create emoji font face
			emojiFace, err = opentype.NewFace(emojiTT, &opentype.FaceOptions{
				Size:    24 * scaleFactor,
				DPI:     dpi,
				Hinting: font.HintingFull,
			})
			if err != nil {
				log.Printf("Failed to create emoji font face: %v", err)
			}
		}
	}

	// Initialize random seed
	random = rand.New(rand.NewSource(time.Now().UnixNano()))

	// Initialize and run game
	game := NewGame()
	if err := ebiten.RunGame(game); err != nil {
		log.Fatal(err)
	}
}
