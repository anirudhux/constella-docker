Feature: Vertical URLs
  As someone who received a curated Constella link
  I want the graph to load and render from the URL alone
  So that I never have to upload anything to see the demo

  @core
  Scenario: A registered showcase link renders its graph directly
    Given I open the path "/v/atlas"
    Then the graph view is rendered by default
    And the page title is "Atlas Knowledge Base — Constella"
    And the browser path stays "/v/atlas"

  @regression
  Scenario: An unregistered slug falls through to the home page
    Given I open the path "/v/not-a-thing"
    Then I see a primary button "Upload a structured file"
