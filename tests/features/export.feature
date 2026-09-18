Feature: Export
  As a user
  I want to export the graph in multiple formats
  So that I can reuse it offline or elsewhere

  Background:
    Given a dataset is open
    And I have opened "Share & embed"

  @smoke @core
  Scenario: Three export formats are offered
    Then I see "Interactive HTML" described as "Standalone file, works offline"
    And I see "Image (PNG)" described as "Snapshot of the current view"
    And I see "JSON manifest" described as "Portable, re-importable"

  @smoke @wip
  Scenario: PNG export exposes the Constella mark toggle, checked by default
    Then the "Image (PNG)" row shows an "Include Constella mark" checkbox
    And the "Include Constella mark" checkbox is checked by default

  # @wip: download assertions need Playwright download-event handling — Wave 3.
  @regression @wip
  Scenario: Interactive HTML downloads a standalone file
    When I click "Download" for "Interactive HTML"
    Then a single self-contained ".html" file is downloaded

  @regression @wip
  Scenario: PNG export captures the current view
    Given I have framed the graph a particular way
    When I click "Download" for "Image (PNG)"
    Then a ".png" snapshot of the current view is downloaded

  Scenario: JSON can be downloaded or copied
    When I click "Download" for "Data (JSON)"
    Then a ".json" file of raw nodes and links is downloaded
    When I click "Copy" for "Data (JSON)"
    Then the raw JSON is placed on the clipboard

  @regression @wip @expected
  Scenario Outline: The Constella mark toggle controls the watermark on the PNG
    Given the "Include Constella mark" checkbox is "<state>"
    When I click "Download" for "Image (PNG)"
    Then the exported PNG "<result>" the Constella mark

    Examples:
      | state     | result        |
      | checked   | includes      |
      | unchecked | does not show |
