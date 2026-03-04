Final Curl:

1. Initiate Request:

curl --location 'https://hub.crifhighmark.com/Inquiry/do.getSecureService/DTC/initiate' \
--header 'orderId: f21fe430-6010-43d6-9533-327873d9895e' \
--header 'accessCode: Y3JpZjFfY3B1X3ByZF9iYmNjaXJwcm9AcnBuZmludHJhbGVhc2UuY29tfE5CRjAwMDQzMzV8QkJDX0NPTlNVTUVSX1NDT1JFIzg1IzIuMHxEMzIzQTBCMTRGMDlGOEU4MUVERTZGRkVBMjNDQjgzOEMzRDAxNjZBfDIwMjYwMjIwMTUzMDQ1=' \
--header 'appID: A4^#@$yt!8e*h0W@$hy#*c^&WU#%^' \
--header 'merchantID: NBF0004335' \
--header 'Content-Type: text/plain' \
--header 'Cookie: JSESSIONID=F4l6huCwl__1D77m2aEZucaqioKaP83KEGD9Mv84USfpoanY3wm_!-391537749; X-Oracle-BMC-LBS-Route=3d3b12a8c42dc6c55dfaf6994ee2386c6596d6d8' \
--data 'ASHUTOSH||DHEWAL|||||9810254998||||||||||||||||||||||||||||NBF0004335|BBC_CONSUMER_SCORE#85#2.0|Y|'


2. Authenticate:

curl --location 'https://hub.crifhighmark.com/Inquiry/do.getSecureService/DTC/response' \
--header 'requestType: AUTHENTICATE' \
--header 'reportId: CCR260220CR849837755' \
--header 'Accept: application/xml' \
--header 'orderId: f21fe430-6010-43d6-9533-327873d9895e' \
--header 'accessCode: Y3JpZjFfY3B1X3ByZF9iYmNjaXJwcm9AcnBuZmludHJhbGVhc2UuY29tfE5CRjAwMDQzMzV8QkJDX0NPTlNVTUVSX1NDT1JFIzg1IzIuMHxEMzIzQTBCMTRGMDlGOEU4MUVERTZGRkVBMjNDQjgzOEMzRDAxNjZBfDIwMjYwMjIwMTUzMDQ1=' \
--header 'appID: A4^#@$yt!8e*h0W@$hy#*c^&WU#%^' \
--header 'merchantID: NBF0004335' \
--header 'Content-Type: application/xml' \
--header 'Cookie: JSESSIONID=S0p6k9BAofSpYgNx41ItiJVMSvOgx5GSR4Le1J_USKSuqfEg8-9Z!-568583355; X-Oracle-BMC-LBS-Route=3d3b12a8c42dc6c55dfaf6994ee2386c6596d6d8; JSESSIONID=hq96lSquy8ps7cRRz2u0-EAD9hGLR0BKHbRryesLd_-1DYPkYSf0!2118989899; X-Oracle-BMC-LBS-Route=3d3b12a8c42dc6c55dfaf6994ee2386c6596d6d8' \
--data 'f21fe430-6010-43d6-9533-327873d9895e|CCR260220CR849837755|Y3JpZjFfY3B1X3ByZF9iYmNjaXJwcm9AcnBuZmludHJhbGVhc2UuY29tfE5CRjAwMDQzMzV8QkJDX0NPTlNVTUVSX1NDT1JFIzg1IzIuMHxEMzIzQTBCMTRGMDlGOEU4MUVERTZGRkVBMjNDQjgzOEMzRDAxNjZBfDIwMjYwMjIwMTUzMDQ1=|https://cir.crifhighmark.com/Inquiry/B2B/secureService.action|N|N|Y'

3. Get Report:

curl --location 'https://hub.crifhighmark.com/Inquiry/do.getSecureService/DTC/response' \
--header 'requestType: GET_REPORT' \
--header 'reportId: CCR260220CR849837755' \
--header 'Accept: application/xml' \
--header 'orderId: f21fe430-6010-43d6-9533-327873d9895e' \
--header 'accessCode: Y3JpZjFfY3B1X3ByZF9iYmNjaXJwcm9AcnBuZmludHJhbGVhc2UuY29tfE5CRjAwMDQzMzV8QkJDX0NPTlNVTUVSX1NDT1JFIzg1IzIuMHxEMzIzQTBCMTRGMDlGOEU4MUVERTZGRkVBMjNDQjgzOEMzRDAxNjZBfDIwMjYwMjIwMTUzMDQ1=' \
--header 'appID: A4^#@$yt!8e*h0W@$hy#*c^&WU#%^' \
--header 'merchantID: NBF0004335' \
--header 'Content-Type: application/xml' \
--header 'Cookie: JSESSIONID=S0p6k9BAofSpYgNx41ItiJVMSvOgx5GSR4Le1J_USKSuqfEg8-9Z!-568583355; X-Oracle-BMC-LBS-Route=3d3b12a8c42dc6c55dfaf6994ee2386c6596d6d8' \
--data 'f21fe430-6010-43d6-9533-327873d9895e|CCR260220CR849837755|Y3JpZjFfY3B1X3ByZF9iYmNjaXJwcm9AcnBuZmludHJhbGVhc2UuY29tfE5CRjAwMDQzMzV8QkJDX0NPTlNVTUVSX1NDT1JFIzg1IzIuMHxEMzIzQTBCMTRGMDlGOEU4MUVERTZGRkVBMjNDQjgzOEMzRDAxNjZBfDIwMjYwMjIwMTUzMDQ1=|https://cir.crifhighmark.com/Inquiry/B2B/secureService.action|N|N|Y|Y'


On Fri, 20 Feb 2026 at 15:27, ashu dhewal <ashudhewal@gmail.com> wrote:
curl --location 'https://test.crifhighmark.com/Inquiry/do.getSecureService/DTC/initiate' \
--header 'orderId: e01ceb90-daf0-41cf-98e9-420666012eae' \
--header 'accessCode: Y3JpZjFfY3B1X3VhdF9iYmNjaXJwcm9AcnBuZmludHJhbGVhc2UuY29tfE5CRjAwMDMzNTl8QkJDX0NPTlNVTUVSX1NDT1JFIzg1IzIuMHwxNjUwNTAwNTVCMUI3MDMyNENFNTAzOEE0M0I4OTIzQUQ2Q0U4QTA5fDIxLTA4LTIwMjQgMTI6MTU6NTE=' \
--header 'appID: f4^$E9?*V8T^ty#*c^&F!@45r1&' \
--header 'merchantID: NBF0003359' \
--header 'Content-Type: text/plain' \
--header 'Cookie: SESSIONID=U4Z6dSppgSXM0xSBYgG9trG-_FFoNzVu6o7EXD3EZp5cUeQuw3ZL!-253154290!1771581024874; JSESSIONID=U4Z6dSppgSXM0xSBYgG9trG-_FFoNzVu6o7EXD3EZp5cUeQuw3ZL!-253154290' \
--data-raw 'ASHUTOSH ||DHEWAL||06-11-1995|||9810254998|||ashudhewal@gmail.com.com||BWKPD0449P||CA38352681758583|||||||||||||||||||||NBF0003359|BBC_CONSUMER_SCORE#85#2.0|Y|'




curl --location 'https://test.crifhighmark.com/Inquiry/do.getSecureService/DTC/response' \
--header 'requestType: Authorization' \
--header 'reportId: CCR260220CR385171475' \
--header 'Accept: application/xml' \
--header 'orderId: e01ceb90-daf0-41cf-98e9-420666012eae' \
--header 'accessCode: Y3JpZjFfY3B1X3VhdF9iYmNjaXJwcm9AcnBuZmludHJhbGVhc2UuY29tfE5CRjAwMDMzNTl8QkJDX0NPTlNVTUVSX1NDT1JFIzg1IzIuMHwxNjUwNTAwNTVCMUI3MDMyNENFNTAzOEE0M0I4OTIzQUQ2Q0U4QTA5fDIxLTA4LTIwMjQgMTI6MTU6NTE=' \
--header 'appID: f4^$E9?*V8T^ty#*c^&F!@45r1&' \
--header 'merchantID: NBF0003359' \
--header 'Content-Type: text/plain' \
--header 'Cookie: SESSIONID=U4Z6dSppgSXM0xSBYgG9trG-_FFoNzVu6o7EXD3EZp5cUeQuw3ZL!-253154290!1771581024874; JSESSIONID=U4Z6dSppgSXM0xSBYgG9trG-_FFoNzVu6o7EXD3EZp5cUeQuw3ZL!-253154290' \
--data 'e01ceb90-daf0-41cf-98e9-420666012eae|CCR260220CR385171475|Y3JpZjFfY3B1X3VhdF9iYmNjaXJwcm9AcnBuZmludHJhbGVhc2UuY29tfE5CRjAwMDMzNTl8QkJDX0NPTlNVTUVSX1NDT1JFIzg1IzIuMHwxNjUwNTAwNTVCMUI3MDMyNENFNTAzOEE0M0I4OTIzQUQ2Q0U4QTA5fDIxLTA4LTIwMjQgMTI6MTU6NTE=|https://cir.crifhighmark.com/Inquiry/B2B/secureService.action%7CN%7CN%7CY'


curl --location 'https://test.crifhighmark.com/Inquiry/do.getSecureService/DTC/response' \
--header 'reportId: CCR260220CR385171445' \
--header 'Accept: application/xml' \
--header 'orderId: e01ceb90-daf0-41cf-98e9-420666012eae' \
--header 'accessCode: Y3JpZjFfY3B1X3VhdF9iYmNjaXJwcm9AcnBuZmludHJhbGVhc2UuY29tfE5CRjAwMDMzNTl8QkJDX0NPTlNVTUVSX1NDT1JFIzg1IzIuMHwxNjUwNTAwNTVCMUI3MDMyNENFNTAzOEE0M0I4OTIzQUQ2Q0U4QTA5fDIxLTA4LTIwMjQgMTI6MTU6NTE=' \
--header 'appID: f4^$E9?*V8T^ty#*c^&F!@45r1&' \
--header 'merchantID: NBF0003359' \
--header 'Content-Type: text/plain' \
--header 'Cookie: SESSIONID=U4Z6dSppgSXM0xSBYgG9trG-_FFoNzVu6o7EXD3EZp5cUeQuw3ZL!-253154290!1771581024874; JSESSIONID=U4Z6dSppgSXM0xSBYgG9trG-_FFoNzVu6o7EXD3EZp5cUeQuw3ZL!-253154290' \
--data 'e01ceb90-daf0-41cf-98e9-420666012eae|CCR260220CR385171445|Y3JpZjFfY3B1X3VhdF9iYmNjaXJwcm9AcnBuZmludHJhbGVhc2UuY29tfE5CRjAwMDMzNTl8QkJDX0NPTlNVTUVSX1NDT1JFIzg1IzIuMHwxNjUwNTAwNTVCMUI3MDMyNENFNTAzOEE0M0I4OTIzQUQ2Q0U4QTA5fDIxLTA4LTIwMjQgMTI6MTU6NTE=|https://cir.crifhighmark.com/Inquiry/B2B/secureService.action%7CN%7CN%7CY


