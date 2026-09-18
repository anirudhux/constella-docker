Feature: Chart nav default
  As a user
  I want the graph to open on the Circle chart
  So that the default view is the familiar one

  Background:
    Given a dataset is open

  @smoke @core
  Scenario: Circle is the default active chart
    Then the "Circle" control is active on first open
