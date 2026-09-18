Feature: Outline view
  As a user who prefers reading to exploring
  I want an indented outline of the hierarchy
  So that I can scan structure and node types

  Background:
    Given a graph is open in the workspace

  # PARKED: the Outline view has been off the nav since a72a25a (Jul 2026) —
  # component exists but the trigger was deliberately removed ("Flatten the
  # chart nav", 7c15b30). Revive this test only if Outline returns to the nav.
  @smoke @regression @wip
  Scenario: Switching to Outline shows an indented hierarchy
    When I click "Outline"
    Then the hierarchy is shown as an indented list
    And the root appears at the top labeled "ROOT"

  Scenario: Outline rows show node types
    Given the Outline view is shown
    Then top-level items are labeled with their type, such as "DOMAIN"
    And nested items are labeled with their type, such as "FOLDER"

  Scenario: Outline reflects the same dataset as the graph
    Given a dataset is open
    When I compare the Outline to the header counts
    Then the outline contains the same top-level nodes shown in the graph

  @expected
  Scenario: Long outlines scroll within the workspace
    Given the dataset has more rows than fit on screen
    When I scroll the outline
    Then additional rows are revealed without leaving the view
