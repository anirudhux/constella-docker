Feature: Theme
  As a user in different lighting and contexts
  I want a dark and light mode
  So that the app is comfortable to read

  @smoke @regression @core
  Scenario: Toggling theme switches the whole UI
    Given the app is in dark mode
    When I click the theme toggle
    Then the UI switches to light mode
    And the toggle icon changes accordingly

  # @wip: the second half ("upload a file and open a new graph") depends on the
  # upload fixtures landing in Wave 2; re-enable once those steps exist.
  @regression @wip
  Scenario: Theme choice persists across views
    Given I have set dark mode
    When I navigate from the graph back to the landing page
    And I upload a file and open a new graph
    Then the app is still in dark mode

  @expected
  Scenario: Theme choice persists across a page reload
    Given I have set light mode
    When I reload the page
    Then the app reopens in light mode
