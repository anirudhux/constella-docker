Feature: Files below the coverage floor are handled kindly
  As a user whose file only partly forms a hierarchy
  I want to be told how much reads, and to render what fits
  So that I get value without a misleading full map

  Background:
    Given I am on the landing page

  @smoke @regression
  Scenario: A flat list can't be mapped, and it's not an error
    When I upload the "flat-list.csv" fixture
    Then I see the can't-map message
    And it is not shown as an error
    And no partial-render option is offered

  @regression
  Scenario: A mostly-flat file (below the 50% floor) offers no partial render
    When I upload the "mostly-flat.csv" fixture
    Then I see the can't-map message
    And no partial-render option is offered

  @smoke @regression
  Scenario: A partly-structured file offers to render what fits
    When I upload the "partial-hierarchy.csv" fixture
    Then I see the can't-map message
    And the partial-render option is offered

  @regression
  Scenario: Rendering what fits opens the graph with a note
    When I upload the "partial-hierarchy.csv" fixture
    And I render the compatible part
    Then the graph workspace opens
    And a note says part of the file was left out
