Feature: Header and navigation
  As a user in the workspace
  I want clear navigation and context
  So that I always know where I am and can go back

  Background:
    Given a dataset is open

  @smoke
  Scenario: Header shows title and dataset summary
    Then the header shows the dataset title
    And it shows the node, hierarchy, and reference counts

  Scenario: Back control returns to the landing page
    When I click the back control
    Then I return to the landing page
    And the input options are shown again

  Scenario: Upload your document returns to import
    When I click "Upload your document"
    Then I can choose a new structured file to import

  Scenario: Workspace footer carries the brand, tagline, and links
    Then the footer shows the Constella wordmark and the tagline "Turn structured data into interactive graphs"
    And it shows an "@anirudhux" link to "x.com/anirudhux"
    And it shows a LinkedIn link to "linkedin.com/in/anirudhux"
    And it shows a "Privacy" link

  @expected
  Scenario: Privacy control opens the privacy information
    When I click "Privacy"
    Then privacy information is shown
