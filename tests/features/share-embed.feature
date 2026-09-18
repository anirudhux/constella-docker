Feature: Share and embed
  As a user ready to publish
  I want an embed snippet
  So that I can place the graph on a web page

  Background:
    Given a dataset is open
    And I have opened "Share & embed"

  @smoke @core
  Scenario: Embed section explains the CDN-backed snippet
    Then I see text explaining the graph loads its renderer from a CDN so the snippet stays small
    And I see a "Copy embed code" button
    And I see a "View code" expander

  @regression
  Scenario: Viewing the embed code reveals an iframe snippet
    When I expand "View code"
    Then the snippet is an "<iframe srcdoc=...>" containing a full HTML document
    And the document title references a Constella graph

  Scenario: Copy embed code confirms the copy
    When I click "Copy embed code"
    Then the embed snippet is placed on the clipboard
    And a copied confirmation is indicated

  Scenario: Share dialog can be dismissed
    When I close the "Share & embed" dialog
    Then I return to the workspace with the graph intact
