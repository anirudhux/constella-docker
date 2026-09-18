Feature: Chart type nav
  As a user viewing my data
  I want a flat chart nav (Circle, Spiral, Sunburst)
  So that I can pick the chart that best fits my data in one click

  Background:
    Given a dataset is open

  @core @regression
  Scenario: The chart nav is flat and clicking Spiral activates it
    Then the chart nav buttons are visible
    And the "Circle" toggle is on
    When I click "Spiral"
    Then the "Spiral" toggle is on
    And the "Circle" toggle is off
