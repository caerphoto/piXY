require "open-uri"

class ImageController < ApplicationController
    def data_uri_encode(filedata)
        result = ["data:"]
        result.push filedata.content_type
        result.push ";base64,"
        result.push ActiveSupport::Base64.encode64(filedata.read)
        result.join
    end

    def show
        response = ""
        begin
            open(params[:url]) { |io| response = data_uri_encode io }
        rescue
            response = "ERROR"
        end
        render :text => response
    end

    def upload
        response = ""
        begin
            response = data_uri_encode(params["upload"])
        rescue
            response = "ERROR"
        end
        render :text => response
    end
end
