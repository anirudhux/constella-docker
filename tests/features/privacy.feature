Feature: Privacy and client-side operation
  As a privacy-conscious user
  I want my data to stay in my browser
  So that nothing is uploaded to a server

  @smoke
  Scenario: The app states it runs entirely client-side
    Given I have opened "Share & embed"
    Then I see the reassurance "Everything runs in your browser - no account, no upload."

  @expected @regression
  Scenario: Importing a file performs no upload request
    Given network activity is being monitored
    When I import a local file
    Then no request uploads the file contents to a remote server

  @expected
  Scenario: No account or sign-in is required
    Given I am a new visitor
    When I import a file and open a graph
    Then I am never asked to create an account or sign in
