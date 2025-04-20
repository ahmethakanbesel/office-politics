package main

import (
	"image"
	"image/color"
	"math/rand"

	"github.com/hajimehoshi/ebiten/v2"
	"golang.org/x/image/font"
)

const (
	screenWidth  = 600
	screenHeight = 900

	// Game state constants
	stateGame = iota
	stateGameOver
	stateAbout

	// Resource constants
	minValue = 0
	maxValue = 100

	// Card animation constants
	swipeThreshold = 50
)

var (
	regularFont font.Face
	boldFont    font.Face
	smallFont   font.Face
	emojiFace   font.Face

	// Colors
	colorBackground  = color.RGBA{243, 244, 246, 255}
	colorCard        = color.RGBA{255, 255, 255, 255}
	colorInfoCard    = color.RGBA{249, 250, 251, 255}
	colorCardBorder  = color.RGBA{55, 65, 81, 255}
	colorInfoBorder  = color.RGBA{107, 114, 128, 255}
	colorMotivation  = color.RGBA{239, 68, 68, 180}   // Red
	colorPerformance = color.RGBA{34, 197, 94, 180}   // Green
	colorColleagues  = color.RGBA{234, 179, 8, 180}   // Yellow
	colorBoss        = color.RGBA{59, 130, 246, 180}  // Blue
	colorYesOption   = color.RGBA{34, 197, 94, 255}   // Green
	colorNoOption    = color.RGBA{239, 68, 68, 255}   // Red
	colorSwipeHint   = color.RGBA{107, 114, 128, 255} // Gray
	colorRestartBtn  = color.RGBA{59, 130, 246, 255}  // Blue
	colorTextPrimary = color.RGBA{0, 0, 0, 255}       // Black
	colorTextLight   = color.RGBA{255, 255, 255, 255} // White

	emptySubImage = ebiten.NewImage(3, 3).SubImage(image.Rect(1, 1, 2, 2)).(*ebiten.Image)

	random *rand.Rand
)
