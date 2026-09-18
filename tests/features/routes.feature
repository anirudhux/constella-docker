Feature: Addressable pages
  As a visitor with a shared link
  I want the changelog and use-cases pages to have real URLs
  So that they open directly without touching the wizard

  @core @regression
  Scenario: The changelog lives at /changelog
    Given I open the "/changelog" page
    Then I see the page heading "What’s new"
    And the full changelog list is shown

  @core @regression
  Scenario: Use cases live at /use-cases
    Given I open the "/use-cases" page
    Then I see the page heading "Who is this for?"

  @regression
  Scenario: The legacy hash link upgrades to the real path
    Given I open the "/#use-cases" page
    Then the address becomes "/use-cases"
    And I see the page heading "Who is this for?"
