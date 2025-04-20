package main

// Resources represents the player's current game stats
type Resources struct {
	Motivation  int `json:"motivation"`
	Performance int `json:"performance"`
	Colleagues  int `json:"colleagues"`
	Boss        int `json:"boss"`
	Day         int `json:"day"`
}

// Requirement defines a condition that must be met for a card to appear
type Requirement struct {
	Type       string        `json:"type,omitempty"`       // "and" or "or" for compound requirements
	Conditions []Requirement `json:"conditions,omitempty"` // Sub-requirements for compound conditions
	Resource   string        `json:"resource,omitempty"`   // Resource to check
	Comparison string        `json:"comparison,omitempty"` // "gt", "lt", "gte", "lte", "eq"
	Value      int           `json:"value,omitempty"`      // Value to compare against
}

// Effects defines how resources change
type Effects struct {
	Motivation  int `json:"motivation,omitempty"`
	Performance int `json:"performance,omitempty"`
	Colleagues  int `json:"colleagues,omitempty"`
	Boss        int `json:"boss,omitempty"`
}

// Card represents a decision card in the game
type Card struct {
	ID           string       `json:"id"`
	Text         string       `json:"text"`
	YesText      string       `json:"yesText,omitempty"`
	NoText       string       `json:"noText,omitempty"`
	YesEffects   Effects      `json:"yesEffects,omitempty"`
	NoEffects    Effects      `json:"noEffects,omitempty"`
	IsInfoOnly   bool         `json:"isInfoOnly,omitempty"`
	Effects      Effects      `json:"effects,omitempty"` // For info cards
	Requirements *Requirement `json:"requirements,omitempty"`
	MaxUses      int          `json:"maxUses"`
	Uses         int          `json:"-"` // Not in JSON, tracked at runtime
	ParentCardID string       `json:"parentCardId,omitempty"`

	// Followup cards
	YesFollowup interface{} `json:"yesFollowup,omitempty"`
	NoFollowup  interface{} `json:"noFollowup,omitempty"`
	Followup    interface{} `json:"followup,omitempty"`
}

// FollowupCardItem represents a delayed followup card
type FollowupCardItem struct {
	Card         *Card
	ShowOnDay    int
	ParentCardID string
}
