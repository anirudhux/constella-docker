Feature: Import report
  As a user who has opened a graph
  I want to re-open the import summary at any time
  So that I can confirm what was parsed and re-import without leaving the workspace

  Background:
    Given a dataset is open in the workspace

  @smoke @regression
  Scenario: View report opens the Import report dialog
    When I click "Details"
    Then an "Document details" dialog opens
    And it states the detection confidence and that nothing is inferred
    And it shows metric cards for "Nodes", "Hierarchy links", "Reference links", and "Warnings"
    And it shows the source file name

  Scenario: View report is reachable from both Graph and Outline views
    Then the "View report" control is present in the bottom bar in the Graph view
    And the "View report" control is present in the bottom bar in the Outline view

  @regression
  Scenario: Import report metrics match the workspace header
    When I open the "Import report" dialog
    Then the "Nodes", "Hierarchy links", and "Reference links" cards match the header counts

  Scenario: Import report wording reassures the user nothing was inferred
    When I open the "Import report" dialog
    Then the body text reads similar to "Nothing is inferred — this is exactly what we parsed from your file."

  @regression
  Scenario: The sample reports its source manifest and high confidence
    Given the "Atlas Knowledge Base" sample is open
    When I open the "Import report" dialog
    Then the source file name is "atlas.json"
    And the confidence is shown as "95%"
    And the warnings count is "0"

  Scenario: Done dismisses the Import report and keeps the graph
    Given the "Import report" dialog is open
    When I click "Done"
    Then the dialog closes
    And the graph remains open and interactive

  @expected
  Scenario: Import another starts a fresh import from the report
    Given the "Import report" dialog is open
    When I click "Import another"
    Then I am taken to the upload / review flow for a new file
    And the current graph is replaced only after I confirm the new import
