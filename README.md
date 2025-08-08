# Photo Date Editor

GUI to select photos and assign them to a year.  This in turn is assigned as their date taken exif metadata and their title.

First, "Choose Files" and select a folder that contains only .jpgs. 

Left click photos in left pane to select them.  Left click a photo again to unselect.  After selecting a set of photos, left click year in the right pane to assign them this year.

When done, click button in right pane to download zip of photos with the new metadata and names.  Zip folder will contain only those photos you assigned a year.

Suggest not doing more than ~50 photos at a time.  Site is inefficient and loads them all into RAM.  Hence loading more will slow things down and crash your browser.

(The photos will never leave your machine.  The browser will operate on them locally.)