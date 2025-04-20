package main

import (
	"fmt"
	"image"
	"image/color"
	"math"
	"strings"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/text"
	"github.com/hajimehoshi/ebiten/v2/vector"
	"golang.org/x/image/font"
)

// Button represents a clickable UI element
type Button struct {
	X, Y, Width, Height float64
	Text                string
	Color               color.RGBA
	HoverColor          color.RGBA
	TextColor           color.RGBA
	IsHovered           bool
}

func (g *Game) drawGameScreen(screen *ebiten.Image) {
	// Draw day counter
	dayText := fmt.Sprintf("Gün %d", g.resources.Day)
	w, _ := getBoundsSize(boldFont, dayText)
	drawTextWithOptions(screen, dayText, boldFont,
		(screenWidth-w)/2,
		50,
		colorTextPrimary)

	// Draw stats
	g.drawStats(screen)

	// Draw card stack (behind card)
	g.drawCardStack(screen)

	// Draw current card
	if g.currentCard != nil {
		g.drawCard(screen)
	}

	// Draw about button
	g.drawButton(screen, g.aboutButton)

	// Draw copyright
	copyrightText := "© 2025 Office Politics."
	w, _ = getBoundsSize(smallFont, copyrightText)
	drawTextWithOptions(screen, copyrightText, smallFont,
		(screenWidth-w)/2,
		screenHeight-10,
		colorSwipeHint)
}

func (g *Game) drawStats(screen *ebiten.Image) {
	// Stats container
	statContainerWidth := 280.0
	statContainerHeight := 65.0
	statContainerX := (screenWidth - statContainerWidth) / 2
	statContainerY := 70.0

	// Draw container
	vector.DrawFilledRect(screen, float32(statContainerX), float32(statContainerY), float32(statContainerWidth), float32(statContainerHeight), colorCard, true)

	// Draw stat icons
	iconSize := 45.0
	spacing := (statContainerWidth - 4*iconSize) / 5
	iconY := statContainerY + (statContainerHeight-iconSize)/2

	motivationX := statContainerX + spacing
	g.drawStatIcon(screen, motivationX, iconY, iconSize,
		g.resources.Motivation, colorMotivation, "M", "Motivasyon")

	// Performance stat (chart)
	performanceX := motivationX + iconSize + spacing
	g.drawStatIcon(screen, performanceX, iconY, iconSize,
		g.resources.Performance, colorPerformance, "P", "Performans")

	// Colleagues stat (people)
	colleaguesX := performanceX + iconSize + spacing
	g.drawStatIcon(screen, colleaguesX, iconY, iconSize,
		g.resources.Colleagues, colorColleagues, "A", "İş Arkadaşları")

	// Boss stat (tie)
	bossX := colleaguesX + iconSize + spacing
	g.drawStatIcon(screen, bossX, iconY, iconSize,
		g.resources.Boss, colorBoss, "P", "Patron")
}

func (g *Game) drawStatIcon(screen *ebiten.Image, x, y, size float64,
	value int, fillColor color.RGBA, symbol, _ string,
) {
	centerX := x + size/2
	centerY := y + size/2
	radius := size / 2

	// Draw circle border
	vector.DrawFilledCircle(screen, float32(centerX), float32(centerY), float32(radius), colorCardBorder, true)

	// Draw white background (slightly smaller for border effect)
	vector.DrawFilledCircle(screen, float32(centerX), float32(centerY), float32(radius-2), colorCard, true)

	// Draw fill based on value percentage
	if value > 0 {
		// Create a temporary image for the fill
		fillImg := ebiten.NewImage(int(size), int(size))

		// Fill the temporary image with our color
		vector.DrawFilledCircle(fillImg, float32(size/2), float32(size/2), float32(radius-2), fillColor, true)

		// Calculate how much of the circle to show based on value
		fillHeight := size * float64(value) / 100.0
		emptyHeight := size - fillHeight

		// Draw the fill image with a partial clip
		op := &ebiten.DrawImageOptions{}
		op.GeoM.Translate(x, y)

		// Set up clipping to only show the bottom portion
		if emptyHeight > 0 {
			// Create a rectangular clip region for the bottom part
			screen.SubImage(image.Rect(
				int(x),
				int(y+emptyHeight),
				int(x+size),
				int(y+size))).(*ebiten.Image).DrawImage(fillImg, op)
		} else {
			// Show the entire fill
			screen.DrawImage(fillImg, op)
		}
	}

	// Draw symbol text - using the updated measurement approach
	advance := font.MeasureString(regularFont, symbol)
	metrics := regularFont.Metrics()
	textWidth := float64(advance) / 64 // Convert fixed.Int26_6 to float64
	textHeight := float64(metrics.Ascent+metrics.Descent) / 64

	textX := int(x + (size-textWidth)/2)
	textY := int(y + size/2 + textHeight/4)

	drawTextWithOptions(screen, symbol, regularFont, textX, textY, colorTextPrimary)
}

func (g *Game) drawCardStack(screen *ebiten.Image) {
	return // Currently disabled

	// Card dimensions and position
	cardWidth := 400.0
	cardHeight := 500.0
	cardX := (screenWidth - cardWidth) / 2
	cardY := (screenHeight-cardHeight)/2 + 50 // Offset down a bit from center

	// Draw stack items (back to front)
	for i := len(g.stackItems) - 1; i >= 0; i-- {
		item := g.stackItems[i]

		// Apply stack item offsets
		itemX := cardX + item.X
		itemY := cardY + item.Y

		// Draw stack card with semi-transparency
		alpha := uint8(item.Opacity * 255)
		bgColor := color.RGBA{255, 255, 255, alpha}

		// Draw stack card background
		vector.DrawFilledRect(screen,
			float32(itemX),
			float32(itemY),
			float32(cardWidth),
			float32(cardHeight),
			bgColor,
			true)

		// Draw stack card border
		borderColor := color.RGBA{55, 65, 81, alpha}

		// Create a path for stroking the border
		path := vector.Path{}

		// Define the rectangle for the border
		path.MoveTo(float32(itemX), float32(itemY))
		path.LineTo(float32(itemX+cardWidth), float32(itemY))
		path.LineTo(float32(itemX+cardWidth), float32(itemY+cardHeight))
		path.LineTo(float32(itemX), float32(itemY+cardHeight))
		path.LineTo(float32(itemX), float32(itemY))

		// Create stroke options
		strokeOptions := &vector.StrokeOptions{
			Width:    1,
			LineJoin: vector.LineJoinMiter,
			LineCap:  vector.LineCapButt,
		}

		// Stroke the path to draw the border
		vs, is := path.AppendVerticesAndIndicesForStroke(nil, nil, strokeOptions)
		for i := range vs {
			vs[i].SrcX = 1
			vs[i].SrcY = 1
			vs[i].ColorR = float32(borderColor.R) / 255
			vs[i].ColorG = float32(borderColor.G) / 255
			vs[i].ColorB = float32(borderColor.B) / 255
			vs[i].ColorA = float32(borderColor.A) / 255
		}

		screen.DrawTriangles(vs, is, emptySubImage, &ebiten.DrawTrianglesOptions{})
	}
}

func (g *Game) drawCard(screen *ebiten.Image) {
	// Card dimensions and position
	cardWidth := 400.0
	cardHeight := 500.0
	basePosX := (screenWidth - cardWidth) / 2
	basePosY := (screenHeight-cardHeight)/2 + 50 // Offset down a bit from center

	// Apply card animation transformations
	cardPosX := basePosX + g.cardX
	cardPosY := basePosY + g.cardY

	// Create a temporary image for the card
	cardImg := ebiten.NewImage(int(cardWidth), int(cardHeight))

	// Fill the card with background color
	var bgColor color.RGBA
	if g.currentCard.IsInfoOnly {
		bgColor = colorInfoCard
	} else {
		// Apply gradient color based on drag position
		if g.dragging && math.Abs(g.currentX) > 30 {
			if g.currentX > 0 {
				// Swiping right - green tint
				greenIntensity := math.Min(math.Abs(g.currentX)/400, 0.3)
				bgColor = color.RGBA{
					uint8(255 - greenIntensity*100), // Reduce red to make it more green
					uint8(255),                      // Keep green at maximum
					uint8(255 - greenIntensity*150), // Reduce blue to make it more green
					255,
				}
			} else {
				// Swiping left - red tint
				redIntensity := math.Min(math.Abs(g.currentX)/400, 0.3)
				bgColor = color.RGBA{
					uint8(255),
					uint8(255 - redIntensity*150),
					uint8(255 - redIntensity*150),
					255,
				}
			}
		} else {
			bgColor = colorCard
		}
	}

	// Clear the card image with transparency
	cardImg.Clear()

	// Draw rectangle for the card background (sharp corners)
	vector.DrawFilledRect(cardImg, 0, 0, float32(cardWidth), float32(cardHeight), bgColor, true)

	// Draw border on the card image (sharp corners)
	var borderColor color.RGBA
	if g.currentCard.IsInfoOnly {
		borderColor = colorInfoBorder
	} else {
		borderColor = colorCardBorder
	}

	// Draw border lines manually for sharp corners
	borderWidth := float32(1)                                                                                                                               // Adjust border thickness if needed
	vector.StrokeLine(cardImg, 0, 0, float32(cardWidth), 0, borderWidth, borderColor, true)                                                                 // Top
	vector.StrokeLine(cardImg, float32(cardWidth)-borderWidth/2, 0, float32(cardWidth)-borderWidth/2, float32(cardHeight), borderWidth, borderColor, true)  // Right (adjust for thickness)
	vector.StrokeLine(cardImg, float32(cardWidth), float32(cardHeight)-borderWidth/2, 0, float32(cardHeight)-borderWidth/2, borderWidth, borderColor, true) // Bottom (adjust for thickness)
	vector.StrokeLine(cardImg, borderWidth/2, float32(cardHeight), borderWidth/2, 0, borderWidth, borderColor, true)                                        // Left (adjust for thickness)

	// Draw card text
	textMargin := 20
	textWidth := int(cardWidth) - 2*textMargin
	textX := textMargin
	textY := int(cardHeight) / 3

	// Draw text with proper wrapping
	drawWrappedText(cardImg, g.currentCard.Text, regularFont, textX, textY, textWidth, colorTextPrimary)

	// Draw decision options if not info card
	if !g.currentCard.IsInfoOnly {
		// Define drag threshold for showing options
		dragThreshold := 30.0

		// Yes option (right side)
		yesText := g.currentCard.YesText
		if yesText == "" {
			yesText = "Evet"
		}
		w, _ := getBoundsSize(boldFont, yesText)
		yesX := int(cardWidth) - textMargin - w
		yesY := int(cardHeight) - 40

		// Only show "Yes" option when dragging right past threshold
		if g.dragging && g.currentX > dragThreshold {
			drawTextWithOptions(cardImg, yesText, boldFont, yesX, yesY, colorYesOption)
		}

		// No option (left side)
		noText := g.currentCard.NoText
		if noText == "" {
			noText = "Hayır"
		}
		noX := textMargin
		noY := int(cardHeight) - 40

		// Only show "No" option when dragging left past threshold
		if g.dragging && g.currentX < -dragThreshold {
			drawTextWithOptions(cardImg, noText, boldFont, noX, noY, colorNoOption)
		}

		// If not dragging far enough in either direction, show swipe hint
		if !g.dragging || math.Abs(g.currentX) <= dragThreshold {
			swipeText := "Kaydırmak için sürükle"
			w, _ := getBoundsSize(smallFont, swipeText)
			swipeX := (int(cardWidth) - w) / 2
			swipeY := int(cardHeight) - 30
			drawTextWithOptions(cardImg, swipeText, smallFont, swipeX, swipeY, colorSwipeHint)
		}
	} else {
		// If info card, show swipe indicator
		swipeText := "Kaydırmak için sürükle"
		w, _ := getBoundsSize(smallFont, swipeText)
		swipeX := (int(cardWidth) - w) / 2
		swipeY := int(cardHeight) - 30
		drawTextWithOptions(cardImg, swipeText, smallFont, swipeX, swipeY, colorSwipeHint)
	}

	// Create a rotation matrix
	op := &ebiten.DrawImageOptions{}

	// Set center of rotation
	centerX := cardWidth / 2
	centerY := cardHeight / 2

	// Apply rotation
	op.GeoM.Translate(-centerX, -centerY)
	op.GeoM.Rotate(g.cardRotation * math.Pi / 180)
	op.GeoM.Translate(centerX, centerY)

	// Apply position
	op.GeoM.Translate(cardPosX, cardPosY)

	// Apply opacity
	op.ColorScale.Scale(1, 1, 1, float32(g.cardOpacity))

	// Draw the card
	screen.DrawImage(cardImg, op)
}

// drawRoundedRect draws a rounded rectangle (kept for potential future use, but not used by drawCard anymore)
func drawRoundedRect(dst *ebiten.Image, x, y, width, height, radius float32, clr color.RGBA, fill bool) {
	// Draw the fill if requested
	if fill {
		vector.DrawFilledRect(dst, x+radius, y, width-radius*2, height, clr, true)
		vector.DrawFilledRect(dst, x, y+radius, width, height-radius*2, clr, true)

		// Draw four corners
		vector.DrawFilledCircle(dst, x+radius, y+radius, radius, clr, true)
		vector.DrawFilledCircle(dst, x+width-radius, y+radius, radius, clr, true)
		vector.DrawFilledCircle(dst, x+radius, y+height-radius, radius, clr, true)
		vector.DrawFilledCircle(dst, x+width-radius, y+height-radius, radius, clr, true)
	} else {
		// Draw the four sides of the border
		vector.StrokeLine(dst, x+radius, y, x+width-radius, y, 1, clr, true)               // Top
		vector.StrokeLine(dst, x+width, y+radius, x+width, y+height-radius, 1, clr, true)  // Right
		vector.StrokeLine(dst, x+radius, y+height, x+width-radius, y+height, 1, clr, true) // Bottom
		vector.StrokeLine(dst, x, y+radius, x, y+height-radius, 1, clr, true)              // Left

		// Draw the four corners
		drawCornerArc(dst, x+radius, y+radius, radius, math.Pi, math.Pi*1.5, clr)        // Top-left
		drawCornerArc(dst, x+width-radius, y+radius, radius, math.Pi*1.5, 0, clr)        // Top-right
		drawCornerArc(dst, x+width-radius, y+height-radius, radius, 0, math.Pi*0.5, clr) // Bottom-right
		drawCornerArc(dst, x+radius, y+height-radius, radius, math.Pi*0.5, math.Pi, clr) // Bottom-left
	}
}

// drawCornerArc draws an arc for a corner of the rounded rectangle (kept for potential future use)
func drawCornerArc(dst *ebiten.Image, x, y, radius float32, startAngle, endAngle float64, clr color.RGBA) {
	// Number of segments to approximate the arc
	segments := 16

	// Calculate the angle step
	angleStep := (endAngle - startAngle) / float64(segments)

	// Draw the segments that make up the arc
	for i := 0; i < segments; i++ {
		angle1 := startAngle + float64(i)*angleStep
		angle2 := startAngle + float64(i+1)*angleStep

		x1 := x + radius*float32(math.Cos(angle1))
		y1 := y + radius*float32(math.Sin(angle1))
		x2 := x + radius*float32(math.Cos(angle2))
		y2 := y + radius*float32(math.Sin(angle2))

		vector.StrokeLine(dst, x1, y1, x2, y2, 1, clr, true)
	}
}

func (g *Game) drawButton(screen *ebiten.Image, button Button) {
	// Determine button color based on hover state
	btnColor := button.Color
	if button.IsHovered {
		btnColor = button.HoverColor
	}

	// Draw button background
	vector.DrawFilledRect(screen, float32(button.X), float32(button.Y), float32(button.Width), float32(button.Height), btnColor, true)

	// Draw button text
	w, h := getBoundsSize(boldFont, button.Text)
	textX := int(button.X + (button.Width-float64(w))/2)
	textY := int(button.Y + (button.Height+float64(h))/2)
	drawTextWithOptions(screen, button.Text, boldFont, textX, textY, button.TextColor)
}

func (g *Game) drawGameOverScreen(screen *ebiten.Image) {
	// Create overlay
	overlayImg := ebiten.NewImage(screenWidth, screenHeight)
	overlayImg.Fill(color.RGBA{0, 0, 0, 200})

	// Draw overlay
	screen.DrawImage(overlayImg, nil)

	// Game over title
	gameOverText := "Oyun Bitti!"
	w, _ := getBoundsSize(boldFont, gameOverText)
	drawTextWithOptions(screen, gameOverText, boldFont,
		(screenWidth-w)/2,
		screenHeight/2-80,
		colorTextLight)

	// Game over reason
	drawWrappedText(screen, g.gameOverReason, regularFont,
		screenWidth/2-150, screenHeight/2-40,
		300, colorTextLight)

	// Days lasted message
	daysMessage := fmt.Sprintf("%d gün dayanabildiniz.", g.resources.Day-1)
	w, _ = getBoundsSize(regularFont, daysMessage)
	drawTextWithOptions(screen, daysMessage, regularFont,
		(screenWidth-w)/2,
		screenHeight/2+20,
		colorTextLight)

	// Draw restart button
	g.drawButton(screen, g.restartButton)
}

func (g *Game) drawAboutScreen(screen *ebiten.Image) {
	// Create overlay
	overlayImg := ebiten.NewImage(screenWidth, screenHeight)
	overlayImg.Fill(color.RGBA{0, 0, 0, 200})

	// Draw overlay
	screen.DrawImage(overlayImg, nil)

	// About container
	aboutWidth := 500.0
	aboutHeight := 350.0
	aboutX := (screenWidth - aboutWidth) / 2
	aboutY := (screenHeight - aboutHeight) / 2

	// Draw container background
	vector.DrawFilledRect(screen, float32(aboutX), float32(aboutY), float32(aboutWidth), float32(aboutHeight), colorCardBorder, true)

	// Title
	aboutTitleText := "Office Politics Hakkında"
	w, _ := getBoundsSize(boldFont, aboutTitleText)
	drawTextWithOptions(screen, aboutTitleText, boldFont,
		(screenWidth-w)/2,
		int(aboutY)+40,
		colorTextLight)

	// Text content
	aboutContent := "Bu oyun, Reigns oyunundan ilham alınarak yapılmıştır.\n\n" +
		"Office Politics, ofis hayatındaki kararları simüle eden bir oyundur.\n" +
		"Kartları sağa veya sola kaydırarak kararlar verin ve\n" +
		"(M) motivasyon, (P) performans, (A) iş arkadaşları ve (P) patron memnuniyetini\n" +
		"dengelemeye çalışarak oyunu kazanmaya çalışın.\n\n" +
		"Kapatmak için herhangi bir yere tıklayın."

	drawWrappedText(screen, aboutContent, regularFont,
		int(aboutX)+30, int(aboutY)+80,
		int(aboutWidth)-60, colorTextLight)
}

func drawTextWithOptions(screen *ebiten.Image, str string, face font.Face, x, y int, clr color.Color) {
	text.Draw(screen, str, face, x, y, clr)
}

// Utility to get width and height from font.BoundString
func getBoundsSize(face font.Face, str string) (width, height int) {
	rect, _ := font.BoundString(face, str)
	width = (rect.Max.X - rect.Min.X).Ceil()
	height = (rect.Max.Y - rect.Min.Y).Ceil()
	return
}

// Draw wrapped text with updated API
func drawWrappedText(screen *ebiten.Image, textContent string, fontFace font.Face, x, y, width int, clr color.Color) {
	const lineHeight = 24

	lines := wrapText(textContent, fontFace, width)
	for i, line := range lines {
		drawTextWithOptions(screen, line, fontFace, x, y+i*lineHeight, clr)
	}
}

// Wraps text to fit within given width with updated bounds calculation
func wrapText(content string, fontFace font.Face, width int) []string {
	var result []string

	// Split by newlines first
	paragraphs := strings.Split(content, "\n")

	for _, paragraph := range paragraphs {
		if paragraph == "" {
			result = append(result, "") // Preserve blank lines
			continue
		}

		words := strings.Split(paragraph, " ")
		var line string

		for _, word := range words {
			testLine := line
			if testLine != "" {
				testLine += " "
			}
			testLine += word

			// Check if adding this word exceeds the width
			w, _ := getBoundsSize(fontFace, testLine)
			if w <= width || line == "" {
				line = testLine
			} else {
				result = append(result, line)
				line = word
			}
		}

		if line != "" {
			result = append(result, line)
		}
	}

	return result
}

// Utility function to clamp a value between min and max
func clamp(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}
