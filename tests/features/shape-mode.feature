Feature: All nodes (shape mode)
  As a user who just fed Constella my data
  I want a one-glance view of its whole shape
  So that I can see the structure before diving into any branch

  Background:
    Given a dataset is open

  @core @regression
  Scenario: Toggling All nodes reveals the label-free shape, and a node click dissolves it
    When I click "All nodes"
    Then the "All nodes" toggle is on
    And no graph labels are visible
    When I click the centre of the graph
    Then the "All nodes" toggle is off
    And graph labels are visible again
