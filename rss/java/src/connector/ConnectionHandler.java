package connector;

/* EXPERIMENTAL */

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;


public class ConnectionHandler {
	static ArrayList<String> links = new ArrayList<String>();
	static ArrayList<String> responses = new ArrayList<String>();
	static int failures = 0;
	static int successes = 0;

	public static void main(String[] args) {
		System.out.println("Hello World!");
	}
	
	public static String executePost(String targetURL, String urlParameters) {
		  HttpURLConnection connection = null;

		  try {
		    //Create connection
		    URL url = new URL(targetURL);
		    connection = (HttpURLConnection) url.openConnection();
		    connection.setRequestMethod("GET");
		    connection.setConnectTimeout(20000);
		    connection.setReadTimeout(20000);
		    connection.setRequestProperty("user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36");  

		    connection.setUseCaches(false);
		    connection.setDoOutput(true);

		    //Send request
		    DataOutputStream wr = new DataOutputStream (connection.getOutputStream());
//		    wr.writeBytes(urlParameters);
		    wr.close();
		    
		    //Get Response  
		    InputStream is = connection.getInputStream();
		    int code = connection.getResponseCode();
		    if (code != 200) throw new Exception("Non-200 code");
		    BufferedReader rd = new BufferedReader(new InputStreamReader(is));
		    StringBuffer response = new StringBuffer();
		    String line;
		    while ((line = rd.readLine()) != null) {
		      response.append(line);
		      response.append('\r');
		    }
		    rd.close();
		    ++successes;
		    String responseBody = response.toString();
		    links.add(targetURL);
		    responses.add(responseBody);
		    return responseBody;
		  } catch (Exception e) {
			  ++failures;
			  links.add(targetURL);
			  responses.add(null);
		    //e.printStackTrace(); // Mostly non-200 status code errors
		    return null;
		  } finally {
		    if (connection != null) {
		      connection.disconnect();
		    }
		  }
		}
	
	public static ArrayList<ArrayList<String>> divideLinks (ArrayList<String> urls, int batchLength) {
		ArrayList<ArrayList<String>> batches = new ArrayList<ArrayList<String>>();
		ArrayList<String> batch = new ArrayList<String>();
		urls.forEach(url -> {
			if (batch.size() < batchLength) batch.add(url);
			else {
				batches.add(batch);
				batch.clear();
			}
		});	
		if (batch.size() > 0) batches.add(batch);
		System.out.println("Number of batches: " + batches.size());
		batches.forEach(arr -> {
			executeInParallel(arr);
		});
		System.out.println("Done processing all batches");
		ArrayList<ArrayList<String>> returnThis = new ArrayList<ArrayList<String>>();
		returnThis.add(links);
		returnThis.add(responses);
		
		return returnThis;
	}
	
	public static void executeInParallel (ArrayList<String> urls) {
		ExecutorService threads = Executors.newCachedThreadPool();
		List<Callable<String>> torun = new ArrayList<>();
		urls.forEach(url -> {
			torun.add(new Callable<String>() {
				public String call () {
					String str = executePost(url, "");
					return str;
				}
			});
		});
		
		try {
			System.out.println("Making threads for a batch");
			List<Future<String>> futures = threads.invokeAll(torun);
			threads.shutdown();
		    for (Future<String> fut : futures) {
		        fut.get();
		    }

		    if (!threads.isShutdown()) System.out.println("Thread did not shut down");
		    else System.out.println("Thread has finished and shut down");
		} catch (InterruptedException e) {
			e.printStackTrace();
		} catch (ExecutionException e) {
			e.printStackTrace();
		}
	}
}
