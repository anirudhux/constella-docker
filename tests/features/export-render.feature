Feature: Exported HTML renders standalone
  As a user who downloaded or embedded a graph
  I want the exported file to actually render on its own
  So that the artifact keeps working outside the app

  Background:
    Given a dataset is open

  @core @regression
  Scenario: The offline export boots and draws the graph
    When I generate both standalone export variants from the live app
    Then the offline export renders nodes, labels and a working tooltip with no console errors
    And the embed variant references CDN Three with integrity pinning
    And the offline export size is within the expected envelope
