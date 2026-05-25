import sys
import json
import argparse
import audible
import os
import httpx
from math import ceil
from urllib.parse import parse_qs
from audible import activation_bytes as audible_activation_bytes
from audible.aescipher import decrypt_voucher_from_licenserequest
from audible.login import build_oauth_url, create_code_verifier
from audible.localization import Locale
from audible.register import register as register_device
from audible.client import raise_for_status


def emit_progress(**data):
    print("BOOKSYNC_PROGRESS " + json.dumps(data), file=sys.stderr, flush=True)

def start_external_login(locale="us"):
    """Build the supported external-browser OAuth URL and state."""
    try:
        locale_obj = Locale(locale)
        code_verifier = create_code_verifier()
        oauth_url, serial = build_oauth_url(
            country_code=locale_obj.country_code,
            domain=locale_obj.domain,
            market_place_id=locale_obj.market_place_id,
            code_verifier=code_verifier,
            serial=None,
            with_username=False
        )

        return json.dumps({
            "oauth_url": oauth_url,
            "serial": serial,
            "code_verifier": code_verifier.decode(),
            "domain": locale_obj.domain,
            "locale_code": locale_obj.country_code
        })
    except Exception as e:
        return json.dumps({"error": str(e)})

def register_external(response_url, serial, code_verifier, locale="us"):
    """Registers a new device from the OAuth redirect URL."""
    try:
        parsed = parse_qs(httpx.URL(response_url).query.decode())
        authorization_code = parsed["openid.oa2.authorization_code"][0]

        auth = audible.Authenticator()
        auth.locale = locale
        register_data = register_device(
            authorization_code=authorization_code,
            code_verifier=code_verifier.encode(),
            domain=Locale(locale).domain,
            serial=serial,
            with_username=False
        )
        auth._update_attrs(with_username=False, **register_data)

        return json.dumps(auth.to_dict())
    except Exception as e:
        return json.dumps({"error": str(e)})

def get_library(auth_data_json):
    """Fetches the library for the given auth data."""
    try:
        auth_data = json.loads(auth_data_json)
        auth = audible.Authenticator.from_dict(auth_data)
        client = audible.Client(auth=auth, timeout=60)

        response_groups = (
            "contributors,media,price,product_attrs,product_desc,"
            "product_extended_attrs,product_plan_details,product_plans,"
            "rating,sample,sku,series,reviews,ws4v,origin,"
            "relationships,review_attrs,categories,badge_types,"
            "category_ladders,claim_code_url,is_downloaded,"
            "is_finished,is_returnable,origin_asin,pdf_url,"
            "percent_complete,provided_review"
        )

        num_results = 200
        page = 1
        all_items = []
        first_page = None
        page_total = None

        emit_progress(stage="starting", message="Fetching Audible library")

        while True:
            response = client.get(
                "library",
                page=page,
                num_results=num_results,
                response_groups=response_groups,
                response_callback=lambda resp: resp
            )
            raise_for_status(response)
            library_page = response.json()

            if first_page is None:
                first_page = library_page
                total_count_header = response.headers.get("total-count")
                if total_count_header:
                    try:
                        page_total = max(1, ceil(int(total_count_header) / num_results))
                    except Exception:
                        page_total = None

            items = library_page.get("items", [])
            all_items.extend(items)
            emit_progress(
                stage="page",
                page=page,
                pageTotal=page_total,
                itemsFetched=len(all_items),
                pageItems=len(items),
                message=f"Fetched page {page}" + (f" of {page_total}" if page_total else "")
            )

            if len(items) < num_results:
                break

            page += 1

        library = first_page or {}
        library["items"] = all_items
        emit_progress(
            stage="completed",
            page=page,
            pageTotal=page_total,
            itemsFetched=len(all_items),
            message=f"Fetched {len(all_items)} titles"
        )
        return json.dumps(library)
    except Exception as e:
        return json.dumps({"error": str(e)})

def get_activation_bytes(auth_data_json):
    """Retrieves activation bytes for FFmpeg."""
    try:
        auth_data = json.loads(auth_data_json)
        auth = audible.Authenticator.from_dict(auth_data)

        bytes_hex = audible_activation_bytes.get_activation_bytes(auth)
        return json.dumps({"activation_bytes": bytes_hex})
    except Exception as e:
        return json.dumps({"error": str(e)})

def get_download_url(auth_data_json, asin):
    """Retrieves the download URL for a given ASIN.

    Newer Audible accounts only get AAXC content; classic accounts still get
    AAX. We don't know which until the license request comes back, so we
    request and let the response shape decide. For AAXC we also decrypt the
    voucher here (key + iv) so the conversion step can pass those straight to
    ffmpeg's -audible_key / -audible_iv flags.

    Response shape (always):
      {
        "download_url": "...",
        "format": "aax" | "aaxc",
        "voucher": {"key": "<hex>", "iv": "<hex>"} | None
      }
    """
    try:
        auth_data = json.loads(auth_data_json)
        auth = audible.Authenticator.from_dict(auth_data)
        client = audible.Client(auth=auth)

        last_error = None
        for quality in ("High", "Normal"):
            try:
                license = client.post(
                    f"1.0/content/{asin}/licenserequest",
                    {
                        "drm_type": "Adrm",
                        "consumption_type": "Download",
                        "quality": quality
                    }
                )
                content_license = license.get("content_license") or {}
                content_metadata = content_license.get("content_metadata") or {}
                content_url_block = content_metadata.get("content_url") or {}
                download_url = content_url_block.get("offline_url")
                if not download_url:
                    raise Exception("Audible license response had no offline_url")

                # AAXC responses carry an encrypted voucher in license_response.
                # AAX responses don't — that's how we tell them apart.
                voucher = None
                fmt = "aax"
                if content_license.get("license_response"):
                    try:
                        voucher = decrypt_voucher_from_licenserequest(auth, license)
                        fmt = "aaxc"
                    except Exception as voucher_err:
                        # If we got a license_response but can't decrypt it,
                        # surface the error rather than silently producing a
                        # broken file: ffmpeg with -activation_bytes on an
                        # AAXC stream decrypts to noise that AAC decoders
                        # silently turn into a silent track.
                        raise Exception(
                            "AAXC voucher decryption failed: %s" % str(voucher_err)
                        )

                return json.dumps({
                    "download_url": download_url,
                    "format": fmt,
                    "voucher": voucher,
                })
            except Exception as e:
                last_error = e

        raise last_error or Exception("Failed to retrieve download URL")

    except Exception as e:
        return json.dumps({"error": str(e)})

def get_book_details(auth_data_json, asin):
    """Retrieves detailed catalog metadata for a given ASIN."""
    try:
        auth_data = json.loads(auth_data_json)
        auth = audible.Authenticator.from_dict(auth_data)
        client = audible.Client(auth=auth, timeout=60)

        response_groups = (
            "contributors, media, product_attrs, product_desc, product_extended_attrs, "
            "product_plan_details, product_plans, rating, sample, sku, series, reviews, ws4v, "
            "relationships, review_attrs, categories, category_ladders, claim_code_url, "
            "in_wishlist, listening_status, periodicals, provided_review, product_details"
        )

        response = client.get(
            "catalog/products",
            asin=asin,
            response_groups=response_groups
        )
        products = response.get("products") or []
        if not products:
            raise Exception(f"No catalog product found for ASIN {asin}")
        product = products[0]

        description = (
            product.get("extended_product_description")
            or product.get("publisher_summary")
            or product.get("merchandising_summary")
            or product.get("sku_summary")
            or ""
        )
        rating = product.get("rating")
        overall_distribution = (rating or {}).get("overall_distribution") or {}
        categories = []
        for genre in product.get("category_ladders") or []:
            for ladder in genre.get("ladder", []):
                name = ladder.get("name")
                if name and name not in categories:
                    categories.append(name)

        details = {
            "description": description,
            "duration": f"{product['runtime_length_min']} min" if product.get("runtime_length_min") else "",
            "releaseDate": product.get("release_date") or "",
            "publisher": product.get("publisher_name") or "",
            "format": product.get("content_type") or product.get("content_delivery_type") or "",
            "language": product.get("language") or "",
            "rating": {
                "value": overall_distribution.get("display_average_rating"),
                "count": overall_distribution.get("num_ratings")
            } if overall_distribution.get("display_average_rating") is not None and overall_distribution.get("num_ratings") is not None else None,
            "categories": categories,
            "copyright": product.get("copyright") or "",
            "seriesSequence": str(product["series"][0]["sequence"]) if product.get("series") and product["series"][0].get("sequence") is not None else "",
            "infoLink": product.get("product_site_url") or f"https://www.audible.{auth.locale.domain}/pd/{asin}"
        }
        return json.dumps(details)
    except Exception as e:
        return json.dumps({"error": str(e)})

def main():
    parser = argparse.ArgumentParser(description="BookSync Audible Wrapper")
    parser.add_argument("command", choices=["login_url", "register", "library", "activation", "download_url", "details"])
    parser.add_argument("--response-url", help="OAuth redirect URL (for register)")
    parser.add_argument("--serial", help="Device serial from login_url")
    parser.add_argument("--code-verifier", help="Code verifier from login_url")
    parser.add_argument("--locale", default="us", help="Audible locale")
    parser.add_argument("--auth", help="JSON string of auth data (for library/activation/download_url)")
    parser.add_argument("--asin", help="ASIN of the book (for download_url)")
    
    args = parser.parse_args()
    
    if args.command == "login_url":
        print(start_external_login(args.locale))
    elif args.command == "register":
        if not args.response_url or not args.serial or not args.code_verifier:
            print(json.dumps({"error": "Missing --response-url, --serial, or --code-verifier"}))
            return
        print(register_external(args.response_url, args.serial, args.code_verifier, args.locale))
    elif args.command == "library":
        if not args.auth:
            print(json.dumps({"error": "Missing --auth"}))
            return
        print(get_library(args.auth))
    elif args.command == "activation":
        if not args.auth:
            print(json.dumps({"error": "Missing --auth"}))
            return
        print(get_activation_bytes(args.auth))
    elif args.command == "download_url":
        if not args.auth or not args.asin:
            print(json.dumps({"error": "Missing --auth or --asin"}))
            return
        print(get_download_url(args.auth, args.asin))
    elif args.command == "details":
        if not args.auth or not args.asin:
            print(json.dumps({"error": "Missing --auth or --asin"}))
            return
        print(get_book_details(args.auth, args.asin))

if __name__ == "__main__":
    main()
