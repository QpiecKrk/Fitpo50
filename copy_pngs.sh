#!/bin/bash
ASSETS_DIR="/Users/grzegorzkupiec/Library/Mobile Documents/com~apple~CloudDocs/!!! ROBOCZA !!!!! /Robocza/FitPo50/assets"
BRAIN_DIR="/Users/grzegorzkupiec/.gemini/antigravity/brain/57aab791-a9f8-4528-b64c-8b9224ecbc63"

# List of copies
cp "$BRAIN_DIR/jedz_wiecej_2_infografika_gen_1774605468827.png" "$ASSETS_DIR/jedz_wiecej_2_infografika.png"
cp "$BRAIN_DIR/jedz_wiecej_3_bialko_gen_1774605499839.png" "$ASSETS_DIR/jedz_wiecej_3_bialko.png"
cp "$BRAIN_DIR/jedz_wiecej_4_woda_gen_1774605523593.png" "$ASSETS_DIR/jedz_wiecej_4_woda.png"
cp "$BRAIN_DIR/jedz_wiecej_shared_meal_new_1774604776137.png" "$ASSETS_DIR/jedz_wiecej_5_posilki.png"
cp "$BRAIN_DIR/jedz_wiecej_moderation_new_1774604806960.png" "$ASSETS_DIR/jedz_wiecej_6_balans.png"
cp "$BRAIN_DIR/jedz_wiecej_plate_method_new_1774604790140.png" "$ASSETS_DIR/jedz_wiecej_7_metoda_talerza.png"

# Verification
ls -l "$ASSETS_DIR"/jedz_wiecej_[2-7]*
