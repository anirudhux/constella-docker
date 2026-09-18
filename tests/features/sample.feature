Feature: Sample input
  As a visitor who wants to evaluate quickly
  I want to load a prepared sample
  So that I can explore a fully populated graph without my own file

  @smoke @regression
  Scenario: Loading the sample opens a populated graph
    Given I am on the landing page
    When I click "Try sample input"
    Then the workspace opens with the title "Atlas Knowledge Base"
    And a "Sample" badge is shown next to the title
    And the header reports "350 nodes", "349 hierarchy", and "32 reference links"
    And the graph view is rendered by default

  Scenario: Sample header counts are internally consistent
    Given the "Atlas Knowledge Base" sample is loaded
    Then the hierarchy link count is exactly one less than the node count
    And the reference link count is a non-negative number

  @core
  Scenario: Workspace controls are available after the sample loads
    Given the sample graph is open
    Then I see header actions "Upload New File", "Settings", and "Share & embed"
    And I see view controls "Details", "Reset view", "Circle", and "Sunburst"
    And I see a back control to return to the landing page
