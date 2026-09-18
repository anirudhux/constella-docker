Feature: Landing page and entry points
  As a first-time visitor
  I want to understand what Constella does and how to start
  So that I can import my data or try a sample

  @smoke @core
  Scenario: Landing page presents the value proposition
    Given I open the Constella home page
    Then I see the headline "Turn structured data into an interactive hierarchy graph."
    And I see the subtext explaining I confirm the structure and nothing is inferred
    And I see the Constella wordmark in the header
    And I see a theme toggle in the top-right corner

  @smoke
  Scenario: Three supported input types are described
    Given I am on the landing page
    Then I see an input type "Spreadsheet" described as "CSV or Excel with hierarchy columns"
    And I see an input type "Markdown outline" described as "Headings, bullets, or a numbered outline"
    And I see an input type "JSON manifest" described as "A prepared nodes-and-links manifest"

  Scenario: Primary and secondary calls to action are present
    Given I am on the landing page
    Then I see a primary button "Upload a structured file"
    And I see a secondary link "Try sample input"

  Scenario: Use-case section lists target audiences
    Given I am on the landing page
    When I scroll to the "Who is this for?" section
    Then I see use cases including "Knowledge bases", "Org charts", "Taxonomies", and "Dependency maps"
    And I see additional use cases such as "Citation maps" and "Information architecture"

  Scenario: Footer shows the tagline, attribution links, and privacy
    Given I am on the landing page
    Then the footer shows the Constella wordmark with the tagline "Turn structured data into interactive graphs"
    And I see an "@anirudhux" link pointing to "x.com/anirudhux"
    And I see a LinkedIn link pointing to "linkedin.com/in/anirudhux"
    And I see a "Privacy" link
